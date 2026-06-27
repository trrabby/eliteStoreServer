import httpStatus from "http-status";
import slugify from "slugify";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

const generateSlug = async (name: string): Promise<string> => {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let count = 1;

  while (true) {
    const exists = await prisma.category.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${count}`;
    count++;
  }

  return slug;
};

// calculate depth from parentId
const calculateDepth = async (parentId?: number): Promise<number> => {
  if (!parentId) return 0;

  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { depth: true },
  });

  if (!parent) {
    throw new AppError(httpStatus.NOT_FOUND, "Parent category not found");
  }

  return parent.depth + 1;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create category — admin only
const createCategory = async (
  payload: {
    name: string;
    description?: string;
    parentId?: number;
    sortOrder?: number;
    isActive?: boolean;
    metaTitle?: string;
    metaDesc?: string;
  },
  image?: string,
  icon?: string,
) => {
  // validate parent exists if provided
  if (payload.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: payload.parentId },
    });

    if (!parent) {
      throw new AppError(httpStatus.NOT_FOUND, "Parent category not found");
    }

    if (!parent.isActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot add a child to an inactive category",
      );
    }
  }

  const slug = await generateSlug(payload.name);
  const depth = await calculateDepth(payload.parentId);

  const category = await prisma.category.create({
    data: {
      name: payload.name,
      slug,
      depth,
      description: payload.description ?? null,
      parentId: payload.parentId ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
      metaTitle: payload.metaTitle ?? null,
      metaDesc: payload.metaDesc ?? null,
      image: image ?? null,
      icon: icon ?? null,
    },
    include: {
      parent: {
        select: { id: true, name: true, slug: true, depth: true },
      },
    },
  });

  return category;
};

// get all root categories with children tree — public
const getCategoryTree = async () => {
  const roots = await prisma.category.findMany({
    where: {
      parentId: null,
      isActive: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
    include: {
      children: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          children: {
            where: {
              isActive: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
            include: {
              children: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
      },
    },
  });

  // ----------------------------------------
  // Get all active product-category mappings
  // ----------------------------------------
  const productCategories = await prisma.productCategory.findMany({
    where: {
      product: {
        status: "ACTIVE",
      },
    },
    select: {
      categoryId: true,
      productId: true,
    },
  });

  // categoryId -> unique productIds
  const productMap = new Map<number, Set<number>>();

  productCategories.forEach((pc) => {
    if (!productMap.has(pc.categoryId)) {
      productMap.set(pc.categoryId, new Set());
    }

    productMap.get(pc.categoryId)!.add(pc.productId);
  });

  // ----------------------------------------
  // Recursive calculator
  // ----------------------------------------
  const calculateCounts = (category: any) => {
    const ownProducts = new Set(productMap.get(category.id) ?? []);

    let subcategoryCount = category.children.length;

    category.children = category.children.map((child: any) => {
      const updatedChild = calculateCounts(child);

      updatedChild.productIds.forEach((id: number) => ownProducts.add(id));

      subcategoryCount += updatedChild.subcategoryCount;

      return updatedChild;
    });

    return {
      ...category,
      productCount: ownProducts.size,
      subcategoryCount,
      productIds: ownProducts,
    };
  };

  const tree = roots.map(calculateCounts);

  // remove helper property before returning
  const cleanTree = (category: any) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    icon: category.icon,
    parentId: category.parentId,
    depth: category.depth,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    metaTitle: category.metaTitle,
    metaDesc: category.metaDesc,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    productCount: category.productCount,
    subcategoryCount: category.subcategoryCount,
    children: category.children.map(cleanTree),
  });

  return tree.map(cleanTree);
};

// get all categories flat — admin
const getAllCategoriesFlat = async (query: {
  page?: number;
  limit?: number;
  depth?: number;
  isActive?: boolean;
  search?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.depth !== undefined) where.depth = query.depth;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }],
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { children: true, products: true },
        },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return { total, page, limit, categories };
};

const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: {
      slug,
      isActive: true,
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          depth: true,
        },
      },
      children: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          icon: true,
          depth: true,
        },
      },
    },
  });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  // ----------------------------------------------------
  // Get all categories once
  // ----------------------------------------------------
  const allCategories = await prisma.category.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      parentId: true,
    },
  });

  // ----------------------------------------------------
  // Build parent -> children map
  // ----------------------------------------------------
  const childrenMap = new Map<number, number[]>();

  allCategories.forEach((cat) => {
    if (cat.parentId !== null) {
      if (!childrenMap.has(cat.parentId)) {
        childrenMap.set(cat.parentId, []);
      }

      childrenMap.get(cat.parentId)!.push(cat.id);
    }
  });

  // ----------------------------------------------------
  // Get all descendant ids
  // ----------------------------------------------------
  const getDescendantIds = (categoryId: number): number[] => {
    const descendants: number[] = [];

    const dfs = (id: number) => {
      const children = childrenMap.get(id) || [];

      for (const child of children) {
        descendants.push(child);
        dfs(child);
      }
    };

    dfs(categoryId);

    return descendants;
  };

  // ----------------------------------------------------
  // Helper for counts
  // ----------------------------------------------------
  const getCounts = async (categoryId: number) => {
    const descendants = getDescendantIds(categoryId);

    const categoryIds = [categoryId, ...descendants];

    const productCount = await prisma.product.count({
      where: {
        categories: {
          some: {
            categoryId: {
              in: categoryIds,
            },
          },
        },
        status: "ACTIVE",
      },
    });

    return {
      productCount,
      subcategoryCount: descendants.length,
    };
  };

  // ----------------------------------------------------
  // Root category counts
  // ----------------------------------------------------
  const rootCounts = await getCounts(category.id);

  // ----------------------------------------------------
  // Child counts
  // ----------------------------------------------------
  const children = await Promise.all(
    category.children.map(async (child) => {
      const counts = await getCounts(child.id);

      return {
        ...child,
        productCount: counts.productCount,
        subcategoryCount: counts.subcategoryCount,
      };
    }),
  );

  return {
    ...category,
    productCount: rootCounts.productCount,
    subcategoryCount: rootCounts.subcategoryCount,
    children,
  };
};

// get category by id — admin
const getCategoryById = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: {
        select: { id: true, name: true, slug: true },
      },
      children: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          depth: true,
        },
      },
      _count: {
        select: { products: true, children: true },
      },
    },
  });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  return category;
};

// update category — admin only
const updateCategory = async (
  id: number,
  payload: {
    name?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    metaTitle?: string;
    metaDesc?: string;
  },
  image?: string,
  icon?: string,
) => {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  // regenerate slug only if name changed
  let slug: string | undefined;

  if (payload.name && payload.name !== category.name) {
    slug = await generateSlug(payload.name);
  }

  // if deactivating — also deactivate all children recursively
  if (payload.isActive === false) {
    await prisma.category.updateMany({
      where: { parentId: id },
      data: { isActive: false },
    });
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...payload,
      image: image ?? category.image,
      icon: icon ?? category.icon,
      ...(slug && { slug }),
    },
    include: {
      parent: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return updated;
};

// delete category — admin only
const deleteCategory = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { children: true, products: true },
      },
    },
  });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  // block if it has children
  if (category._count.children > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a category that has subcategories. Delete or Shift subcategories first.",
    );
  }

  // block if it has products
  if (category._count.products > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a category that has products. Remove or reassign products first.",
    );
  }

  await prisma.category.delete({ where: { id } });

  return "Category deleted successfully";
};

export const categoryService = {
  createCategory,
  getCategoryTree,
  getAllCategoriesFlat,
  getCategoryBySlug,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
