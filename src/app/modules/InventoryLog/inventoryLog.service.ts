import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// get inventory logs with filters — admin
const getAllInventoryLogs = async (query: {
  page?: number;
  limit?: number;
  variantId?: number;
  productId?: number;
  reason?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 30;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.variantId) where.variantId = query.variantId;
  if (query.reason)
    where.reason = { contains: query.reason, mode: "insensitive" };

  // filter by productId via variant
  if (query.productId) {
    where.variant = { productId: query.productId };
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            stock: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  return { total, page, limit, logs };
};

// get all inventory logs of a specific vendor — admin/vendor
const getVendorInventoryLogs = async (
  vendorId: number,
  query: {
    page?: number;
    limit?: number;
    variantId?: number;
    productId?: number;
    reason?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 30;
  const skip = (page - 1) * limit;
  const where: any = {
    variant: {
      product: {
        vendorId,
      },
    },
  };

  if (query.variantId) where.variantId = query.variantId;
  if (query.reason)
    where.reason = { contains: query.reason, mode: "insensitive" };

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            stock: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  return { total, page, limit, logs };
};

// get logs for a specific variant
const getVariantInventoryLogs = async (
  variantId: number,
  query: { page?: number; limit?: number },
) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      product: { select: { id: true, name: true } },
    },
  });

  if (!variant) {
    throw new AppError(httpStatus.NOT_FOUND, "Variant not found");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where: { variantId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryLog.count({ where: { variantId } }),
  ]);

  return { variant, total, page, limit, logs };
};

// get low stock variants — admin
const getLowStockVariants = async (query: {
  page?: number;
  limit?: number;
  threshold?: number;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const threshold = query.threshold ?? 5;

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        stock: { lte: threshold },
      },
      skip,
      take: limit,
      orderBy: { stock: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        lowStockAlert: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
            vendor: {
              select: { storeName: true },
            },
          },
        },
      },
    }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        stock: { lte: threshold },
      },
    }),
  ]);

  return { total, page, limit, threshold, variants };
};

// get low stock variants - vendor
const getLowStockVariantsByVendor = async (
  vendorId: number,
  query: {
    page?: number;
    limit?: number;
    threshold?: number;
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const threshold = query.threshold ?? 5;

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        stock: { lte: threshold },
        product: { vendorId },
      },
      skip,
      take: limit,
      orderBy: { stock: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        lowStockAlert: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
            vendor: {
              select: { storeName: true },
            },
          },
        },
      },
    }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        stock: { lte: threshold },
        product: { vendorId },
      },
    }),
  ]);

  return { total, page, limit, threshold, variants };
};

// get all stock variants of a specific vendor — admin/vendor
const getAllVendorStockVariants = async (
  vendorId: number,
  query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    minStock?: number;
    maxStock?: number;
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const search = query.search;
  const status = query.status; // 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'
  const sortBy = query.sortBy ?? "stock_asc";
  const minStock = query.minStock;
  const maxStock = query.maxStock;

  // Build where clause
  let whereClause: any = {
    isActive: true,
    product: { vendorId },
  };

  // Search by product name or variant SKU/name
  if (search) {
    whereClause.OR = [
      { sku: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { product: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Filter by stock status
  if (status === "IN_STOCK") {
    whereClause.stock = { gt: 10 };
  } else if (status === "LOW_STOCK") {
    whereClause.stock = { gt: 0, lte: 10 };
  } else if (status === "OUT_OF_STOCK") {
    whereClause.stock = 0;
  }

  // Filter by stock range
  if (minStock !== undefined && maxStock !== undefined) {
    whereClause.stock = { ...whereClause.stock, gte: minStock, lte: maxStock };
  } else if (minStock !== undefined) {
    whereClause.stock = { ...whereClause.stock, gte: minStock };
  } else if (maxStock !== undefined) {
    whereClause.stock = { ...whereClause.stock, lte: maxStock };
  }

  // Build order by
  let orderBy: any = {};
  switch (sortBy) {
    case "stock_asc":
      orderBy = { stock: "asc" };
      break;
    case "stock_desc":
      orderBy = { stock: "desc" };
      break;
    case "name_asc":
      orderBy = { product: { name: "asc" } };
      break;
    case "name_desc":
      orderBy = { product: { name: "desc" } };
      break;
    case "updatedAt_desc":
      orderBy = { updatedAt: "desc" };
      break;
    case "updatedAt_asc":
      orderBy = { updatedAt: "asc" };
      break;
    default:
      orderBy = { stock: "asc" };
  }

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        lowStockAlert: true,
        price: true,
        comparePrice: true,
        costPrice: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            status: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true, altText: true },
            },
            vendor: {
              select: {
                id: true,
                storeName: true,
                isVerified: true,
              },
            },
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        // Only select the fields that exist on VariantOptionValue
        optionValues: {
          select: {
            value: true,
            valueId: true,
            variantId: true,
          },
        },
      },
    }),
    prisma.productVariant.count({
      where: whereClause,
    }),
  ]);

  // Calculate summary statistics
  const summary = await prisma.productVariant.aggregate({
    where: whereClause,
    _sum: { stock: true },
    _avg: { stock: true },
    _min: { stock: true },
    _max: { stock: true },
  });

  const stockDistribution = await prisma.productVariant.groupBy({
    by: ["stock"],
    where: whereClause,
    _count: true,
  });

  // Transform the response to simplify categories and optionValues
  const transformedVariants = variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    stock: variant.stock,
    lowStockAlert: variant.lowStockAlert,
    price: variant.price,
    comparePrice: variant.comparePrice,
    costPrice: variant.costPrice,
    isActive: variant.isActive,
    isDefault: variant.isDefault,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
    product: {
      id: variant.product.id,
      name: variant.product.name,
      slug: variant.product.slug,
      description: variant.product.description,
      status: variant.product.status,
      images: variant.product.images,
      vendor: variant.product.vendor,
      categories: variant.product.categories.map((pc) => pc.category),
    },
    optionValues: variant.optionValues,
  }));

  return {
    total,
    page,
    limit,
    variants: transformedVariants,
    summary: {
      totalStock: summary._sum.stock || 0,
      averageStock: summary._avg.stock || 0,
      minStock: summary._min.stock || 0,
      maxStock: summary._max.stock || 0,
    },
    distribution: stockDistribution,
  };
};
// get out of stock variants — admin
const getOutOfStockVariants = async (query: {
  page?: number;
  limit?: number;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, stock: 0 },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        sku: true,
        name: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            vendor: {
              select: { storeName: true },
            },
          },
        },
      },
    }),
    prisma.productVariant.count({
      where: { isActive: true, stock: 0 },
    }),
  ]);

  return { total, page, limit, variants };
};

// get out of stock variants - vendor
const getOutOfStockVariantsByVendor = async (
  vendorId: number,
  query: { page?: number; limit?: number },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, stock: 0, product: { vendorId } },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        sku: true,
        name: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            vendor: {
              select: { storeName: true },
            },
          },
        },
      },
    }),
    prisma.productVariant.count({
      where: { isActive: true, stock: 0, product: { vendorId } },
    }),
  ]);

  return { total, page, limit, variants };
};

// inventory stats — admin dashboard
const getInventoryStats = async () => {
  const [totalVariants, activeVariants, outOfStock, lowStock, totalStockValue] =
    await Promise.all([
      prisma.productVariant.count(),
      prisma.productVariant.count({ where: { isActive: true } }),
      prisma.productVariant.count({ where: { stock: 0 } }),
      prisma.productVariant.count({
        where: {
          isActive: true,
          stock: { gt: 0, lte: 5 },
        },
      }),
      prisma.productVariant.aggregate({
        where: { isActive: true },
        _sum: { stock: true },
      }),
    ]);

  // top 5 reasons for stock change
  const reasonBreakdown = await prisma.inventoryLog.groupBy({
    by: ["reason"],
    _count: { reason: true },
    _sum: { change: true },
    orderBy: { _count: { reason: "desc" } },
    take: 10,
  });

  return {
    totalVariants,
    activeVariants,
    outOfStock,
    lowStock,
    totalStockUnits: totalStockValue._sum.stock ?? 0,
    reasonBreakdown,
  };
};

export const inventoryLogService = {
  getAllInventoryLogs,
  getVariantInventoryLogs,
  getAllVendorStockVariants,
  getLowStockVariants,
  getLowStockVariantsByVendor,
  getOutOfStockVariants,
  getOutOfStockVariantsByVendor,
  getInventoryStats,
};
