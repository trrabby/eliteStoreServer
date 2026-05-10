import httpStatus from "http-status";
import slugify from "slugify";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

export const generateSlug = async (name: string): Promise<string> => {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let count = 1;

  while (true) {
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${count}`;
    count++;
  }

  return slug;
};

// find or create option + value, return valueId
const resolveOptionValue = async (
  tx: any,
  optionName: string,
  value: string,
): Promise<number> => {
  // find or create the option
  let option = await tx.productOption.findFirst({
    where: { name: { equals: optionName, mode: "insensitive" } },
  });

  if (!option) {
    option = await tx.productOption.create({
      data: { name: optionName },
    });
  }

  // find or create the value under that option
  let optionValue = await tx.productOptionValue.findFirst({
    where: {
      optionId: option.id,
      value: { equals: value, mode: "insensitive" },
    },
  });

  if (!optionValue) {
    optionValue = await tx.productOptionValue.create({
      data: { optionId: option.id, value },
    });
  }

  return optionValue.id;
};

// ─────────────────────────────────────────
// PRODUCT SERVICES
// ─────────────────────────────────────────

const createProduct = async (
  email: string,
  payload: {
    name: string;
    shortDescription?: string;
    description?: string;
    brandId?: number;
    categoryIds: number[];
    tags?: string[];
    status?: string;
    isFeatured?: boolean;
    metaTitle?: string;
    metaDesc?: string;
    metaKeywords?: string;
  },
) => {
  // get vendor profile from email
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // admin can create without vendor profile
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  if (!isAdmin && !user.vendorProfile) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You need a vendor profile to create products",
    );
  }

  // validate categories exist
  const categories = await prisma.category.findMany({
    where: { id: { in: payload.categoryIds } },
  });

  if (categories.length !== payload.categoryIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One or more category IDs are invalid",
    );
  }

  // validate brand if provided
  if (payload.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: payload.brandId },
    });
    if (!brand) {
      throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
    }
  }

  const slug = await generateSlug(payload.name);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        vendorId: user.vendorProfile?.id ?? null,
        brandId: payload.brandId ?? null,
        name: payload.name,
        slug,
        shortDescription: payload.shortDescription ?? null,
        description: payload.description ?? null,
        status: (payload.status as any) ?? "DRAFT",
        isFeatured: payload.isFeatured ?? false,
        tags: payload.tags ?? [],
        metaTitle: payload.metaTitle ?? null,
        metaDesc: payload.metaDesc ?? null,
        metaKeywords: payload.metaKeywords ?? null,
      },
    });

    // attach categories
    await tx.productCategory.createMany({
      data: payload.categoryIds.map((categoryId) => ({
        productId: created.id,
        categoryId,
      })),
    });

    return created;
  });

  return product;
};

// get all products — public with filters
const getAllProducts = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  brandId?: number;
  vendorId?: number;
  categoryId?: number;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tags?: string[];
  sortBy?: string; // "price_asc" | "price_desc" | "rating" | "newest" | "popular"
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.brandId) where.brandId = query.brandId;
  if (query.vendorId) where.vendorId = query.vendorId;
  if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;

  if (query.categoryId) {
    where.categories = {
      some: { categoryId: query.categoryId },
    };
  }

  if (query.tags?.length) {
    where.tags = { hasSome: query.tags };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { shortDescription: { contains: query.search, mode: "insensitive" } },
      { tags: { has: query.search } },
    ];
  }

  // price filter on variants
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.variants = {
      some: {
        price: {
          ...(query.minPrice !== undefined && { gte: query.minPrice }),
          ...(query.maxPrice !== undefined && { lte: query.maxPrice }),
        },
        isActive: true,
      },
    };
  }

  // sort
  let orderBy: any = { createdAt: "desc" };
  if (query.sortBy === "rating") orderBy = { averageRating: "desc" };
  if (query.sortBy === "popular") orderBy = { totalSold: "desc" };
  if (query.sortBy === "newest") orderBy = { createdAt: "desc" };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        publicId: true,
        name: true,
        slug: true,
        shortDescription: true,
        status: true,
        isFeatured: true,
        averageRating: true,
        reviewCount: true,
        totalSold: true,
        tags: true,
        createdAt: true,
        brand: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        categories: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where: { isDefault: true, isActive: true },
          take: 1,
          select: { price: true, comparePrice: true, stock: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { total, page, limit, products };
};

// get product by slug — public, full details
const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      brand: {
        select: { id: true, name: true, slug: true, logo: true },
      },
      vendor: {
        select: {
          id: true,
          publicId: true,
          storeName: true,
          slug: true,
          logo: true,
          rating: true,
          isVerified: true,
        },
      },
      categories: {
        select: {
          category: {
            select: { id: true, name: true, slug: true, depth: true },
          },
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      variants: {
        where: { isActive: true },
        include: {
          optionValues: {
            include: {
              value: {
                include: {
                  option: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { isDefault: "desc" },
      },
      attributes: true,
      relatedProducts: {
        include: {
          related: {
            select: {
              id: true,
              publicId: true,
              name: true,
              slug: true,
              averageRating: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true, altText: true },
              },
              variants: {
                where: { isDefault: true },
                take: 1,
                select: { price: true, comparePrice: true },
              },
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  // increment view count — fire and forget
  prisma.product
    .update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {});

  return product;
};

// get product by id — admin/vendor
const getProductById = async (id: number) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      vendor: { select: { id: true, storeName: true } },
      categories: { include: { category: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: {
        include: {
          optionValues: { include: { value: { include: { option: true } } } },
        },
      },
      attributes: true,
      _count: {
        select: { reviews: true, orderItems: true },
      },
    },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  return product;
};

const getMyProducts = async (
  email: string,
  query: { page?: number; limit?: number; status?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });
  // console.log(email, user?.vendorProfile);
  if (!user?.vendorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = { vendorId: user.vendorProfile.id };
  if (query.status) where.status = query.status;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { isDefault: true }, take: 1 },
        _count: { select: { reviews: true, orderItems: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { total, page, limit, products };
};

// update product
const updateProduct = async (
  id: number,
  email: string,
  payload: {
    name?: string;
    shortDescription?: string;
    description?: string;
    brandId?: number | null;
    categoryIds?: number[];
    tags?: string[];
    status?: string;
    isFeatured?: boolean;
    metaTitle?: string;
    metaDesc?: string;
    metaKeywords?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  await verifyProductOwnership(id, email);

  let slug: string | undefined;

  if (payload.name && payload.name !== product.name) {
    slug = await generateSlug(payload.name);
  }

  const { categoryIds, ...rest } = payload;

  const updateData = Object.fromEntries(
    Object.entries(rest).filter(([_, value]) => value !== undefined),
  );

  const updated = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id },
      data: {
        ...updateData,
        statusUpdatedById: user.id,
        ...(slug && { slug }),
      },
    });

    // replace categories if provided
    if (categoryIds?.length) {
      await tx.productCategory.deleteMany({ where: { productId: id } });
      await tx.productCategory.createMany({
        data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
      });
    }

    return updatedProduct;
  });

  return updated;
};

// verify ownership — vendor can only edit their own, admin can edit all
const verifyProductOwnership = async (productId: number, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (isAdmin) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  // console.log(productId, product?.vendorId, user.vendorProfile?.id);
  if (product?.vendorId !== user.vendorProfile?.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to modify this product",
    );
  }
};

// delete product
const deleteProduct = async (id: number, email: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  await verifyProductOwnership(id, email);

  // if product has orders — archive instead of hard delete
  if (product._count.orderItems > 0) {
    await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return "Product archived — it has existing orders and cannot be permanently deleted";
  }

  await prisma.product.delete({ where: { id } });
  return "Product deleted successfully";
};

// ─────────────────────────────────────────
// IMAGE SERVICES
// ─────────────────────────────────────────

const addProductImages = async (
  productId: number,
  email: string,
  images: { url: string; altText?: string; sortOrder?: number }[],
) => {
  await verifyProductOwnership(productId, email);

  // if no primary image exists yet — make first upload primary
  const existingPrimary = await prisma.productImage.findFirst({
    where: { productId, isPrimary: true },
  });

  const created = await prisma.productImage.createMany({
    data: images.map((img, index) => ({
      productId,
      url: img.url,
      altText: img.altText ?? null,
      sortOrder: img.sortOrder ?? index,
      isPrimary: !existingPrimary && index === 0,
    })),
  });

  return created;
};

const setPrimaryImage = async (
  productId: number,
  imageId: number,
  email: string,
) => {
  await verifyProductOwnership(productId, email);

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!image) {
    throw new AppError(httpStatus.NOT_FOUND, "Image not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
    await tx.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  });

  return "Primary image updated";
};

const deleteProductImage = async (
  productId: number,
  imageId: number,
  email: string,
) => {
  await verifyProductOwnership(productId, email);

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!image) {
    throw new AppError(httpStatus.NOT_FOUND, "Image not found");
  }

  await prisma.productImage.delete({ where: { id: imageId } });

  // if deleted image was primary — auto promote next image
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.productImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  return "Image deleted";
};

// ─────────────────────────────────────────
// VARIANT SERVICES
// ─────────────────────────────────────────

const createVariant = async (
  productId: number,
  email: string,
  payload: {
    sku: string;
    name?: string;
    price: number;
    comparePrice?: number;
    costPrice?: number;
    stock?: number;
    lowStockAlert?: number;
    weight?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
    options?: { optionName: string; value: string }[];
  },
) => {
  await verifyProductOwnership(productId, email);
  // console.log(productId, email);
  // check sku uniqueness
  const skuExists = await prisma.productVariant.findUnique({
    where: { sku: payload.sku },
  });

  if (skuExists) {
    throw new AppError(httpStatus.BAD_REQUEST, "SKU already exists");
  }

  const variant = await prisma.$transaction(async (tx) => {
    // if this is default — unset others first
    if (payload.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId },
        data: { isDefault: false },
      });
    }

    // if first variant — auto set as default
    const variantCount = await tx.productVariant.count({
      where: { productId },
    });

    const created = await tx.productVariant.create({
      data: {
        productId,
        sku: payload.sku,
        name: payload.name ?? null,
        price: payload.price,
        comparePrice: payload.comparePrice ?? null,
        costPrice: payload.costPrice ?? null,
        stock: payload.stock ?? 0,
        lowStockAlert: payload.lowStockAlert ?? 5,
        weight: payload.weight ?? null,
        barcode: payload.barcode ?? null,
        isDefault: payload.isDefault ?? variantCount === 0,
        isActive: payload.isActive ?? true,
      },
    });

    // resolve and attach option values
    if (payload.options?.length) {
      const valueIds = await Promise.all(
        payload.options.map((opt) =>
          resolveOptionValue(tx, opt.optionName, opt.value),
        ),
      );

      await tx.variantOptionValue.createMany({
        data: valueIds.map((valueId) => ({
          variantId: created.id,
          valueId,
        })),
      });
    }

    // initial inventory log
    if ((payload.stock ?? 0) > 0) {
      await tx.inventoryLog.create({
        data: {
          variantId: created.id,
          change: payload.stock ?? 0,
          reason: "INITIAL_STOCK",
        },
      });
    }

    return created;
  });

  return variant;
};

const updateVariant = async (
  variantId: number,
  email: string,
  payload: {
    sku?: string;
    name?: string;
    price?: number;
    comparePrice?: number | null;
    costPrice?: number | null;
    stock?: number;
    lowStockAlert?: number;
    weight?: number | null;
    barcode?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  },
) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new AppError(httpStatus.NOT_FOUND, "Variant not found");
  }

  await verifyProductOwnership(variant.productId, email);

  // check sku uniqueness if changing
  if (payload.sku && payload.sku !== variant.sku) {
    const skuExists = await prisma.productVariant.findUnique({
      where: { sku: payload.sku },
    });
    if (skuExists) {
      throw new AppError(httpStatus.BAD_REQUEST, "SKU already exists");
    }
  }

  // if setting as default — unset others
  if (payload.isDefault) {
    await prisma.productVariant.updateMany({
      where: { productId: variant.productId },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: payload,
  });

  return updated;
};

const updateStock = async (
  variantId: number,
  email: string,
  payload: { change: number; reason?: string },
) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new AppError(httpStatus.NOT_FOUND, "Variant not found");
  }

  await verifyProductOwnership(variant.productId, email);

  const newStock = variant.stock + payload.change;

  if (newStock < 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient stock. Current: ${variant.stock}, Requested change: ${payload.change}`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedVariant = await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock },
    });

    await tx.inventoryLog.create({
      data: {
        variantId,
        change: payload.change,
        reason:
          payload.reason ?? (payload.change > 0 ? "RESTOCK" : "ADJUSTMENT"),
      },
    });

    // auto update product status based on total stock
    const totalStock = await tx.productVariant.aggregate({
      where: { productId: variant.productId, isActive: true },
      _sum: { stock: true },
    });

    if ((totalStock._sum.stock ?? 0) === 0) {
      await tx.product.update({
        where: { id: variant.productId },
        data: { status: "OUT_OF_STOCK" },
      });
    } else {
      // bring back to ACTIVE if it was OUT_OF_STOCK
      await tx.product.updateMany({
        where: { id: variant.productId, status: "OUT_OF_STOCK" },
        data: { status: "ACTIVE" },
      });
    }

    return updatedVariant;
  });

  return updated;
};

const deleteVariant = async (variantId: number, email: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      _count: { select: { orderItems: true } },
    },
  });

  if (!variant) {
    throw new AppError(httpStatus.NOT_FOUND, "Variant not found");
  }

  await verifyProductOwnership(variant.productId, email);

  if (variant._count.orderItems > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete — this variant has existing orders",
    );
  }

  // block deleting the only variant
  const variantCount = await prisma.productVariant.count({
    where: { productId: variant.productId },
  });

  if (variantCount === 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete the only variant. Update it instead.",
    );
  }

  await prisma.productVariant.delete({ where: { id: variantId } });

  // if deleted was default — promote next
  if (variant.isDefault) {
    const next = await prisma.productVariant.findFirst({
      where: { productId: variant.productId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.productVariant.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return "Variant deleted successfully";
};

// ─────────────────────────────────────────
// ATTRIBUTE SERVICES
// ─────────────────────────────────────────

const addAttribute = async (
  productId: number,
  email: string,
  payload: { name: string; value: string }[], // Array of attributes
) => {
  await verifyProductOwnership(productId, email);

  // Validate no empty names or values
  for (const attr of payload) {
    if (!attr.name?.trim() || !attr.value?.trim()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Attribute name and value are required",
      );
    }
  }

  // Create all attributes
  const attributes = await prisma.productAttribute.createMany({
    data: payload.map((attr) => ({
      productId,
      name: attr.name,
      value: attr.value,
    })),
    skipDuplicates: true, // Optional: skip if same name+value+productId exists
  });

  // Optional: Return the created attributes
  const createdAttributes = await prisma.productAttribute.findMany({
    where: {
      productId,
      name: { in: payload.map((attr) => attr.name) },
    },
  });

  return {
    count: attributes.count,
    attributes: createdAttributes,
  };
};

const deleteAttribute = async (attributeId: number, email: string) => {
  const attribute = await prisma.productAttribute.findUnique({
    where: { id: attributeId },
  });

  if (!attribute) {
    throw new AppError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  await verifyProductOwnership(attribute.productId, email);
  await prisma.productAttribute.delete({ where: { id: attributeId } });

  return "Attribute deleted";
};

// ─────────────────────────────────────────
// RELATED PRODUCTS
// ─────────────────────────────────────────

const addRelatedProducts = async (
  productId: number,
  email: string,
  relatedProductIds: number[],
) => {
  await verifyProductOwnership(productId, email);

  // filter out self and already existing relations
  const existing = await prisma.relatedProduct.findMany({
    where: { productId },
    select: { relatedId: true },
  });

  const existingIds = existing.map((r) => r.relatedId);

  const newIds = relatedProductIds.filter(
    (id) => id !== productId && !existingIds.includes(id),
  );

  if (!newIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No new related products to add",
    );
  }

  await prisma.relatedProduct.createMany({
    data: newIds.map((relatedId) => ({ productId, relatedId })),
  });

  return "Related products added";
};

const removeRelatedProduct = async (
  productId: number,
  relatedId: number,
  email: string,
) => {
  await verifyProductOwnership(productId, email);

  await prisma.relatedProduct.deleteMany({
    where: { productId, relatedId },
  });

  return "Related product removed";
};

export const productService = {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
  addProductImages,
  setPrimaryImage,
  deleteProductImage,
  createVariant,
  updateVariant,
  updateStock,
  deleteVariant,
  addAttribute,
  deleteAttribute,
  addRelatedProducts,
  removeRelatedProduct,
};
