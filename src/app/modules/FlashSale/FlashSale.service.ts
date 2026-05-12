import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { generateSlug } from "../Product/product.service";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// compute sale price from original price + discount
const computeSalePrice = (
  originalPrice: number,
  discountType: "PERCENTAGE" | "FLAT",
  discountValue: number,
  maxDiscount?: number | null,
): number => {
  let discount = 0;

  if (discountType === "PERCENTAGE") {
    discount = (originalPrice * discountValue) / 100;
    if (maxDiscount && discount > maxDiscount) {
      discount = maxDiscount;
    }
  } else {
    discount = discountValue;
  }

  const salePrice = originalPrice - discount;
  return parseFloat(Math.max(0, salePrice).toFixed(2));
};

// verify vendor owns the product
const verifyVendorProductOwnership = async (
  vendorId: number,
  productId: number,
) => {
  // console.log(vendorId, productId);
  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId },
  });

  if (!product) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Product ${productId} does not belong to your store`,
    );
  }
  return product;
};

// get default variant price for a product
const getProductBasePrice = async (productId: number): Promise<number> => {
  const variant = await prisma.productVariant.findFirst({
    where: { productId, isDefault: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!variant) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Product ${productId} has no active default variant`,
    );
  }

  return Number(variant.price);
};

// ─────────────────────────────────────────
// FLASH SALE CRUD
// ─────────────────────────────────────────

// create flash sale — vendor or admin
const createFlashSale = async (
  email: string,
  payload: {
    title: string;
    description?: string;
    startsAt: string;
    endsAt: string;
  },
  banner?: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  if (!isAdmin && !user.vendorProfile) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You need a vendor profile to create flash sales",
    );
  }

  // 🔥 slug generation
  const slug = await generateSlug(payload.title);

  const flashSale = await prisma.flashSale.create({
    data: {
      title: payload.title,
      slug,
      description: payload.description ?? null,
      banner: banner ?? null,
      startsAt: new Date(payload.startsAt),
      endsAt: new Date(payload.endsAt),
      status: "DRAFT",
      isActive: false,
      vendorId: user.vendorProfile?.id ?? null,
      createdById: user.id,
    },
  });

  return flashSale;
};

// get all flash sales — public (active only) or admin (all)
const getAllFlashSales = async (
  query: {
    page?: number;
    limit?: number;
    status?: string;
    vendorId?: number;
    isActive?: boolean;
  },
  adminView: boolean = false,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (!adminView) {
    // public — only active, ongoing sales
    where.isActive = true;
    where.status = "ACTIVE";
    where.startsAt = { lte: new Date() };
    where.endsAt = { gte: new Date() };
  } else {
    if (query.status) where.status = query.status;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.vendorId) where.vendorId = query.vendorId;
  }

  const [sales, total] = await Promise.all([
    prisma.flashSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startsAt: "asc" },
      include: {
        vendor: {
          select: { storeName: true, slug: true, logo: true },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.flashSale.count({ where }),
  ]);

  return { total, page, limit, sales };
};

// get active flash sale with products — public
const getActiveFlashSale = async () => {
  const now = new Date();

  const sale = await prisma.flashSale.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: "desc" },
    include: {
      items: {
        where: { isActive: true },
        include: {
          product: {
            select: {
              id: true,
              publicId: true,
              name: true,
              slug: true,
              averageRating: true,
              reviewCount: true,
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
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return sale;
};

// get flash sale by publicId
const getFlashSaleBySlug = async (slug: string) => {
  const sale = await prisma.flashSale.findUnique({
    where: { slug },
    include: {
      vendor: {
        select: { storeName: true, slug: true, logo: true },
      },
      createdBy: {
        select: {
          email: true,
          accountInfo: { select: { firstName: true, lastName: true } },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              publicId: true,
              name: true,
              slug: true,
              averageRating: true,
              reviewCount: true,
              status: true,
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
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  return sale;
};

// get my flash sales — vendor
const getMyFlashSales = async (
  email: string,
  query: { page?: number; limit?: number; status?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user?.vendorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = { vendorId: user.vendorProfile.id };
  if (query.status) where.status = query.status;

  const [sales, total] = await Promise.all([
    prisma.flashSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 3,
          select: {
            salePrice: true,
            discountType: true,
            discountValue: true,
            product: {
              select: {
                name: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.flashSale.count({ where }),
  ]);

  return { total, page, limit, sales };
};

// update flash sale — only DRAFT can be edited
const updateFlashSale = async (
  publicId: string,
  email: string,
  payload: {
    title?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
  },
  banner?: string,
) => {
  const sale = await prisma.flashSale.findUnique({ where: { publicId } });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  if (sale.status !== "DRAFT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot edit a sale that is "${sale.status}". Only DRAFT sales can be edited.`,
    );
  }

  await verifyFlashSaleOwnership(publicId, email);

  let slug: string | undefined;

  // 🔥 regenerate slug only if title changes
  if (payload.title && payload.title !== sale.title) {
    slug = await generateSlug(payload.title);
  }

  const updateData = {
    ...payload,
    ...(payload.startsAt && { startsAt: new Date(payload.startsAt) }),
    ...(payload.endsAt && { endsAt: new Date(payload.endsAt) }),
    ...(banner && { banner }),
    ...(slug && { slug }),
  };

  const updated = await prisma.flashSale.update({
    where: { publicId },
    data: updateData,
  });

  return updated;
};

// verify ownership — vendor owns it or admin
const verifyFlashSaleOwnership = async (publicId: string, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (isAdmin) return;

  const sale = await prisma.flashSale.findUnique({ where: { publicId } });

  if (sale?.vendorId !== user.vendorProfile?.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to modify this flash sale",
    );
  }
};

// ─────────────────────────────────────────
// FLASH SALE ITEMS
// ─────────────────────────────────────────

// add products to flash sale — bulk
const addItems = async (
  flashSalePublicId: string,
  email: string,
  items: {
    productId: number;
    discountType: "PERCENTAGE" | "FLAT";
    discountValue: number;
    maxDiscount?: number;
    stock?: number;
  }[],
) => {
  const sale = await prisma.flashSale.findUnique({
    where: { publicId: flashSalePublicId },
  });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  if (sale.status === "ENDED" || sale.status === "CANCELLED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot add products to an ended or cancelled sale",
    );
  }

  await verifyFlashSaleOwnership(flashSalePublicId, email);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const results = {
    added: [] as any[],
    skipped: [] as { productId: number; reason: string }[],
  };

  for (const item of items) {
    try {
      // vendor scope check
      if (!isAdmin && user?.vendorProfile) {
        await verifyVendorProductOwnership(
          user.vendorProfile.id,
          item.productId,
        );
      }

      // check product exists and is active
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          variants: {
            where: { isDefault: true, isActive: true },
            take: 1,
          },
        },
      });

      if (!product || product.status !== "ACTIVE") {
        results.skipped.push({
          productId: item.productId,
          reason: "Product not found or not active",
        });
        continue;
      }

      // if product has no variants or default variant is inactive, through error to skip
      if (!product || product.variants.length === 0) {
        results.skipped.push({
          productId: item.productId,
          reason: "Product not found or has no active default variant",
        });
        continue;
      }

      // ONE OFFER PER PRODUCT — check if already in any active sale
      const existingOffer = await prisma.flashSaleItem.findUnique({
        where: { productId: item.productId },
      });

      const existingFlashSaleName = existingOffer
        ? await prisma.flashSale.findUnique({
            where: { id: existingOffer.flashSaleId },
            select: { title: true, slug: true },
          })
        : null;

      if (existingOffer) {
        results.skipped.push({
          productId: item.productId,
          reason: `Product is already part of ${existingFlashSaleName?.title}, visit: /flash-sales/${existingFlashSaleName?.slug} flash sale offer`,
        });
        continue;
      }

      const originalPrice = Number(product.variants[0]?.price ?? 0);
      const salePrice = computeSalePrice(
        originalPrice,
        item.discountType,
        item.discountValue,
        item.maxDiscount,
      );
      // check stock if provided, must be positive and less than or equal to stock including all variant's stock togather
      let totalStock = 0;

      // find all product variants and sum their stock to get total available stock for the product
      const variants = await prisma.productVariant.findMany({
        where: { productId: item.productId, isActive: true },
        select: { stock: true },
      });
      totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

      if (item.stock !== undefined && item.stock !== null) {
        if (item.stock < 0 || item.stock > totalStock) {
          results.skipped.push({
            productId: item.productId,
            reason: `Invalid stock value. Must be between 0 and ${totalStock}. You have only ${totalStock} items in stock for this product including all variants.`,
          });
          continue;
        }
      }
      const created = await prisma.flashSaleItem.create({
        data: {
          flashSaleId: sale.id,
          productId: item.productId,
          discountType: item.discountType as any,
          discountValue: item.discountValue,
          maxDiscount: item.maxDiscount ?? null,
          originalPrice,
          salePrice,
          stock: item.stock ?? totalStock,
          isActive: true,
          addedById: user?.id,
        },
      });

      results.added.push(created);
    } catch (err: any) {
      results.skipped.push({
        productId: item.productId,
        reason: err.message ?? "Unknown error",
      });
    }
  }

  return {
    addedCount: results.added.length,
    skippedCount: results.skipped.length,
    ...results,
  };
};

// update single item — discount or stock
const updateItem = async (
  itemPublicId: string,
  email: string,
  payload: {
    discountType?: "PERCENTAGE" | "FLAT";
    discountValue?: number;
    maxDiscount?: number | null;
    stock?: number | null;
    isActive?: boolean;
  },
) => {
  const item = await prisma.flashSaleItem.findUnique({
    where: { publicId: itemPublicId },
    include: {
      flashSale: true,
      product: {
        include: {
          variants: {
            where: { isDefault: true, isActive: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale item not found");
  }

  // prevent updating ended/cancelled sales
  if (
    item.flashSale.status === "ENDED" ||
    item.flashSale.status === "CANCELLED"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot update products of an ended or cancelled sale",
    );
  }

  await verifyFlashSaleOwnership(item.flashSale.publicId, email);

  // check product active status
  if (!item.product || item.product.status !== "ACTIVE") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Product not found or not active",
    );
  }

  // check default variant
  if (item.product.variants.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Product has no active default variant",
    );
  }

  // calculate total stock from all active variants
  const variants = await prisma.productVariant.findMany({
    where: {
      productId: item.productId,
      isActive: true,
    },
    select: {
      stock: true,
    },
  });

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  // validate stock
  if (payload.stock !== undefined && payload.stock !== null) {
    if (payload.stock < 0 || payload.stock > totalStock) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid stock value. Must be between 0 and ${totalStock}. You have only ${totalStock} items in stock for this product including all variants.`,
      );
    }
  }

  // recompute sale price if any pricing field changes
  let salePrice: number | undefined;

  const finalDiscountType = payload.discountType ?? (item.discountType as any);

  const finalDiscountValue =
    payload.discountValue ?? Number(item.discountValue);

  const finalMaxDiscount =
    payload.maxDiscount !== undefined
      ? payload.maxDiscount
      : item.maxDiscount
        ? Number(item.maxDiscount)
        : null;

  if (
    payload.discountType !== undefined ||
    payload.discountValue !== undefined ||
    payload.maxDiscount !== undefined
  ) {
    salePrice = computeSalePrice(
      Number(item.originalPrice),
      finalDiscountType,
      finalDiscountValue,
      finalMaxDiscount,
    );
  }

  const updated = await prisma.flashSaleItem.update({
    where: { publicId: itemPublicId },
    data: {
      ...(payload.discountType !== undefined && {
        discountType: payload.discountType,
      }),

      ...(payload.discountValue !== undefined && {
        discountValue: payload.discountValue,
      }),

      ...(payload.maxDiscount !== undefined && {
        maxDiscount: payload.maxDiscount,
      }),

      ...(payload.stock !== undefined && {
        stock: payload.stock ?? totalStock,
      }),

      ...(payload.isActive !== undefined && {
        isActive: payload.isActive,
      }),

      ...(salePrice !== undefined && {
        salePrice,
      }),
    },
  });

  return updated;
};

// remove single product from flash sale
const removeItem = async (itemPublicId: string, email: string) => {
  const item = await prisma.flashSaleItem.findUnique({
    where: { publicId: itemPublicId },
    include: { flashSale: true },
  });

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale item not found");
  }

  if (item.flashSale.status === "ACTIVE") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot remove products from an active sale. Deactivate the item instead.",
    );
  }

  await verifyFlashSaleOwnership(item.flashSale.publicId, email);

  await prisma.flashSaleItem.delete({ where: { publicId: itemPublicId } });

  return "Item removed from flash sale";
};

// remove bulk products from flash sale
const removeItems = async (itemPublicIds: string[], email: string) => {
  const items = await prisma.flashSaleItem.findMany({
    where: { publicId: { in: itemPublicIds } },
    include: { flashSale: true },
  });

  if (items.length === 0) {
    throw new AppError(httpStatus.NOT_FOUND, "No flash sale items found");
  }

  const sale = items[0].flashSale;
  if (sale.status === "ACTIVE") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot remove products from an active sale. Deactivate the items instead.",
    );
  }

  await verifyFlashSaleOwnership(sale.publicId, email);

  await prisma.flashSaleItem.deleteMany({
    where: { publicId: { in: itemPublicIds } },
  });

  return "Items removed from flash sale";
};

// ─────────────────────────────────────────
// SALE LIFECYCLE
// ─────────────────────────────────────────

// activate sale — admin only or vendor
// transitions DRAFT → ACTIVE
const activateFlashSale = async (publicId: string, email: string) => {
  const sale = await prisma.flashSale.findUnique({
    where: { publicId },
    include: { _count: { select: { items: true } } },
  });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  if (sale.status !== "DRAFT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Sale is already "${sale.status}"`,
    );
  }

  if (sale._count.items === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot activate — sale has no products. Add products first.",
    );
  }

  if (new Date(sale.endsAt) <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot activate — sale end date has already passed",
    );
  }

  await verifyFlashSaleOwnership(publicId, email);
  const user = await prisma.user.findUnique({ where: { email } });

  const updated = await prisma.flashSale.update({
    where: { publicId },
    data: {
      status: "ACTIVE",
      isActive: true,
      statusUpdatedById: user?.id ?? null,
    },
  });

  return updated;
};

// cancel sale — ends early
const cancelFlashSale = async (publicId: string, email: string) => {
  const sale = await prisma.flashSale.findUnique({ where: { publicId } });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  if (sale.status === "ENDED" || sale.status === "CANCELLED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Sale is already "${sale.status}"`,
    );
  }

  await verifyFlashSaleOwnership(publicId, email);
  const user = await prisma.user.findUnique({ where: { email } });

  await prisma.$transaction(async (tx) => {
    await tx.flashSale.update({
      where: { publicId },
      data: {
        status: "CANCELLED",
        isActive: false,
        statusUpdatedById: user?.id ?? null,
      },
    });

    // deactivate all items so they no longer show on products
    await tx.flashSaleItem.updateMany({
      where: { flashSaleId: sale.id },
      data: { isActive: false },
    });
  });

  return "Flash sale cancelled";
};

// auto-end expired sales — called by a cron job or on-demand
const endExpiredSales = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  const expired = await prisma.flashSale.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      endsAt: { lt: new Date() },
    },
    select: { id: true, publicId: true },
  });

  for (const sale of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.flashSale.update({
        where: { id: sale.id },
        data: {
          status: "ENDED",
          isActive: false,
          statusUpdatedById: user?.id ?? null,
        },
      });
      await tx.flashSaleItem.updateMany({
        where: { flashSaleId: sale.id },
        data: { isActive: false },
      });
    });
  }

  return { endedCount: expired.length };
};

// delete sale — DRAFT only
const deleteFlashSale = async (publicId: string, email: string) => {
  const sale = await prisma.flashSale.findUnique({ where: { publicId } });

  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, "Flash sale not found");
  }

  if (sale.status !== "DRAFT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only DRAFT sales can be deleted. Cancel active sales first.",
    );
  }

  await verifyFlashSaleOwnership(publicId, email);

  await prisma.flashSale.delete({ where: { publicId } });

  return "Flash sale deleted";
};

// get flash sale stats — admin
const getFlashSaleStats = async () => {
  const [total, draft, active, ended, cancelled, totalItems, totalSold] =
    await Promise.all([
      prisma.flashSale.count(),
      prisma.flashSale.count({ where: { status: "DRAFT" } }),
      prisma.flashSale.count({ where: { status: "ACTIVE" } }),
      prisma.flashSale.count({ where: { status: "ENDED" } }),
      prisma.flashSale.count({ where: { status: "CANCELLED" } }),
      prisma.flashSaleItem.count(),
      prisma.flashSaleItem.aggregate({ _sum: { soldCount: true } }),
    ]);

  return {
    total,
    draft,
    active,
    ended,
    cancelled,
    totalItems,
    totalSold: totalSold._sum.soldCount ?? 0,
  };
};

export const flashSaleService = {
  createFlashSale,
  getAllFlashSales,
  getActiveFlashSale,
  getFlashSaleBySlug,
  getMyFlashSales,
  updateFlashSale,
  addItems,
  updateItem,
  removeItem,
  removeItems,
  activateFlashSale,
  cancelFlashSale,
  endExpiredSales,
  deleteFlashSale,
  getFlashSaleStats,
};
