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
  getLowStockVariants,
  getOutOfStockVariants,
  getInventoryStats,
};
