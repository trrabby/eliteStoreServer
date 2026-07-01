import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// generate human readable order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
};

// check if status transition is allowed
const isValidStatusTransition = (current: string, next: string): boolean => {
  const transitions: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
    OUT_FOR_DELIVERY: ["DELIVERED"],
    DELIVERED: ["RETURN_REQUESTED"],
    RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
    RETURNED: ["REFUNDED"],
    CANCELLED: [],
    REFUNDED: [],
  };

  return transitions[current]?.includes(next) ?? false;
};

// filter keys for listing orders
type FilterKey = "ALL" | "TO_PAY" | "TO_SHIP" | "TO_RECEIVE" | "TO_REVIEW";

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// createOrder — one order per vendor
// ─────────────────────────────────────────
const createOrder = async (
  email: string,
  payload: {
    shippingFeeFromClient?: number;
    shippingAddressId: number;
    billingAddressId?: number;
    couponCode?: string;
    notes?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: {
      cart: {
        include: {
          items: {
            include: {
              product: {
                include: {
                  vendor: true,
                  flashSaleItem: {
                    include: { flashSale: true },
                  },
                },
              },
              variant: true,
            },
          },
        },
      },
    },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.cart?.items.length)
    throw new AppError(httpStatus.BAD_REQUEST, "Cart is empty");

  // ── Helper ────────────────────────────────────────────────────
  const round: any = (value: number) => Math.round(value);

  // ── Validate address ──────────────────────────────────────────
  const shippingAddress = await prisma.address.findFirst({
    where: { id: payload.shippingAddressId, userId: user.id },
  });
  if (!shippingAddress)
    throw new AppError(httpStatus.NOT_FOUND, "Shipping address not found");

  const billingAddress = payload.billingAddressId
    ? await prisma.address.findFirst({
        where: { id: payload.billingAddressId, userId: user.id },
      })
    : null;

  // ── Process each cart item ────────────────────────────────────
  interface ProcessedItem {
    cartItem: any;
    basePrice: number;
    sellingPrice: number;
    defaultDiscount: number;
    flashSaleDiscount: number;
    priceAfterFlashSale: number;
    couponBase: number;
    finalUnitPrice: number;
    flashSaleId?: number;
  }

  const processedItems: ProcessedItem[] = [];
  const issues: string[] = [];

  for (const item of user.cart.items) {
    if (item.product.status !== "ACTIVE")
      issues.push(`"${item.product.name}" is no longer available`);
    if (!item.variant.isActive)
      issues.push(`A variant of "${item.product.name}" is unavailable`);
    if (item.variant.stock < item.quantity)
      issues.push(
        `"${item.product.name}" only has ${item.variant.stock} in stock`,
      );

    const sellingPrice = Number(item.variant.price);
    const comparePrice = item.variant.comparePrice
      ? Number(item.variant.comparePrice)
      : null;

    const basePrice =
      comparePrice && comparePrice > sellingPrice ? comparePrice : sellingPrice;

    const defaultDiscount = Math.max(0, basePrice - sellingPrice);

    let flashSaleDiscount = 0;
    let flashSaleId: number | undefined;

    if (
      item.product.flashSaleItem &&
      item.product.flashSaleItem.flashSale.isActive
    ) {
      const flashSale = item.product.flashSaleItem;
      const flashSaleStatus = await prisma.flashSale.findFirst({
        where: {
          id: flashSale.flashSaleId,
          status: "ACTIVE",
          isActive: true,
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
      });

      if (flashSaleStatus) {
        if (flashSale.discountType === "PERCENTAGE") {
          let discountAmount =
            (sellingPrice * Number(flashSale.discountValue)) / 100;
          if (flashSale.maxDiscount) {
            discountAmount = Math.min(
              discountAmount,
              Number(flashSale.maxDiscount),
            );
          }
          flashSaleDiscount = discountAmount;
        } else {
          flashSaleDiscount = Number(flashSale.discountValue);
        }
        flashSaleId = flashSale.id;
      }
    }

    const priceAfterFlashSale = Math.max(0, sellingPrice - flashSaleDiscount);
    const couponBase = priceAfterFlashSale;
    const finalUnitPrice = priceAfterFlashSale;

    processedItems.push({
      cartItem: item,
      basePrice,
      sellingPrice,
      defaultDiscount,
      flashSaleDiscount,
      priceAfterFlashSale,
      couponBase,
      finalUnitPrice,
      flashSaleId,
    });
  }

  if (issues.length)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cart has issues: ${issues.join(", ")}`,
    );

  // ── Group items by vendor ────────────────────────────────────
  const itemsByVendor = new Map<number | null, typeof processedItems>();
  for (const item of processedItems) {
    const vid = item.cartItem.product.vendorId ?? null;
    if (!itemsByVendor.has(vid)) itemsByVendor.set(vid, []);
    itemsByVendor.get(vid)!.push(item);
  }

  // ── Compute per‑vendor aggregates ────────────────────────────
  const vendorData = new Map<
    number | null,
    {
      subtotal: number;
      defaultDiscountTotal: number;
      flashSaleDiscountTotal: number;
      couponBaseTotal: number;
      items: typeof processedItems;
    }
  >();

  for (const [vendorId, items] of itemsByVendor) {
    let subtotal = 0;
    let defaultDiscountTotal = 0;
    let flashSaleDiscountTotal = 0;
    let couponBaseTotal = 0;

    for (const item of items) {
      const qty = item.cartItem.quantity;
      subtotal += item.basePrice * qty;
      defaultDiscountTotal += item.defaultDiscount * qty;
      flashSaleDiscountTotal += item.flashSaleDiscount * qty;
      couponBaseTotal += item.couponBase * qty;
    }

    vendorData.set(vendorId, {
      subtotal,
      defaultDiscountTotal,
      flashSaleDiscountTotal,
      couponBaseTotal,
      items,
    });
  }

  // ── Coupon validation & distribution ────────────────────────
  let couponId: number | null = null;
  let couponVendorId: number | null = null;
  const couponDiscountPerVendor = new Map<number | null, number>();

  if (payload.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: payload.couponCode.toUpperCase() },
    });
    if (!coupon) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid coupon code");
    }
    couponVendorId = coupon.vendorId ?? null;

    let totalCouponBase = 0;
    const vendorCouponBases = new Map<number | null, number>();
    for (const [vendorId, data] of vendorData) {
      const base = data.couponBaseTotal;
      vendorCouponBases.set(vendorId, base);
      totalCouponBase += base;
    }

    if (couponVendorId !== null) {
      const vendorBase = vendorCouponBases.get(couponVendorId);
      if (!vendorBase || vendorBase <= 0) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "This coupon only applies to products from a specific vendor not in your cart",
        );
      }
      totalCouponBase = vendorBase;
    } else {
      if (totalCouponBase <= 0) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Coupon cannot be applied to zero-value order",
        );
      }
    }

    const couponResult = await validateCouponForUser(
      payload.couponCode,
      user.id,
      totalCouponBase,
    );
    const totalAllowedDiscount = couponResult.discountAmount;
    couponId = couponResult.coupon.id;

    if (couponVendorId !== null) {
      couponDiscountPerVendor.set(couponVendorId, round(totalAllowedDiscount));
    } else {
      let sumAssigned = 0;
      const vendorIds = Array.from(vendorCouponBases.keys());
      for (let i = 0; i < vendorIds.length; i++) {
        const vid = vendorIds[i];
        const base = vendorCouponBases.get(vid)!;
        if (base === 0) {
          couponDiscountPerVendor.set(vid, 0);
          continue;
        }
        let vendorDiscount: number;
        if (coupon.discountType === "PERCENTAGE") {
          let discount = (base * Number(coupon.discountValue)) / 100;
          if (coupon.maxDiscount) {
            discount = Math.min(discount, Number(coupon.maxDiscount));
          }
          vendorDiscount = Math.min(discount, base);
        } else {
          const proportion = base / totalCouponBase;
          vendorDiscount = proportion * totalAllowedDiscount;
        }
        vendorDiscount = round(vendorDiscount);
        if (i === vendorIds.length - 1) {
          vendorDiscount = totalAllowedDiscount - sumAssigned;
        }
        if (vendorDiscount > 0) {
          couponDiscountPerVendor.set(vid, vendorDiscount);
          sumAssigned += vendorDiscount;
        } else {
          couponDiscountPerVendor.set(vid, 0);
        }
      }
    }
  }

  // ── Shipping fee ──────────────────────────────────────────────
  const addressCity = (shippingAddress.city_district ?? "").toLowerCase();
  const baseShippingFee = addressCity === "dhaka" ? 70 : 130;
  const shippingFeePerVendor = payload.shippingFeeFromClient
    ? round(payload.shippingFeeFromClient / itemsByVendor.size)
    : round(baseShippingFee);

  // ── Create orders ────────────────────────────────────────────
  const createdOrders = await prisma.$transaction(async (tx) => {
    const orders: any[] = [];

    for (const [vendorId, data] of vendorData) {
      const {
        subtotal,
        defaultDiscountTotal,
        flashSaleDiscountTotal,
        couponBaseTotal,
        items,
      } = data;
      const couponDiscount = couponDiscountPerVendor.get(vendorId) || 0;
      const totalDiscount =
        defaultDiscountTotal + flashSaleDiscountTotal + couponDiscount;
      const orderTotal = round(
        Math.max(0, subtotal - totalDiscount + shippingFeePerVendor),
      );

      const order = await tx.order.create({
        data: {
          userId: user.id,
          orderNumber: generateOrderNumber(),
          shippingAddressId: payload.shippingAddressId,
          billingAddressId: payload.billingAddressId ?? null,
          status: "PENDING",
          subtotal: subtotal,
          discount: totalDiscount,
          shippingFee: shippingFeePerVendor,
          tax: 0,
          total: orderTotal,
          couponId: couponDiscount > 0 ? couponId : null,
          notes: payload.notes ?? null,
        },
      });

      // Order items
      for (const item of items) {
        const cartItem = item.cartItem;
        const totalCouponForItem =
          couponBaseTotal > 0
            ? couponDiscount * (item.couponBase / couponBaseTotal)
            : 0;
        const finalUnitPrice = Math.max(
          0,
          item.finalUnitPrice - totalCouponForItem,
        );
        const totalPrice = round(finalUnitPrice * cartItem.quantity);

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: cartItem.productId,
            variantId: cartItem.variantId,
            quantity: cartItem.quantity,
            unitPrice: finalUnitPrice,
            totalPrice: totalPrice,
            snapshot: {
              productId: cartItem.product.id,
              productName: cartItem.product.name,
              productSlug: cartItem.product.slug,
              variantName: cartItem.variant.name,
              variantSku: cartItem.variant.sku,
              vendorName: cartItem.product.vendor?.storeName ?? null,
              basePrice: item.basePrice,
              defaultDiscount: item.defaultDiscount,
              flashSaleDiscount: item.flashSaleDiscount,
              couponDiscount: couponDiscountPerVendor.get(vendorId) || 0,
              finalPrice: finalUnitPrice,
              discountSources: {
                comparePrice: item.defaultDiscount > 0 ? "comparePrice" : null,
                flashSale: item.flashSaleId ? "flashSale" : null,
              },
              flashSaleId: item.flashSaleId,
              appliedAt: new Date().toISOString(),
            },
          },
        });

        await tx.productVariant.update({
          where: { id: cartItem.variantId },
          data: { stock: { decrement: cartItem.quantity } },
        });

        await tx.inventoryLog.create({
          data: {
            variantId: cartItem.variantId,
            change: -cartItem.quantity,
            reason: "SALE",
            referenceId: order.id,
          },
        });

        await tx.product.update({
          where: { id: cartItem.productId },
          data: { totalSold: { increment: cartItem.quantity } },
        });

        if (item.flashSaleId) {
          await tx.flashSaleItem.update({
            where: { id: item.flashSaleId },
            data: { soldCount: { increment: cartItem.quantity } },
          });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          note: "Order placed successfully",
        },
      });

      orders.push(order);
    }

    if (couponId && orders.length > 0) {
      await tx.couponUsage.create({
        data: {
          couponId,
          userId: user.id,
          orderId: orders[0].id,
        },
      });
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: user.cart!.id } });

    return orders;
  });

  // ── Return details ───────────────────────────────────────────
  const detailed = await Promise.all(
    createdOrders.map((o) => getOrderById(o.id, user.id, false)),
  );

  const shippingTotal = shippingFeePerVendor * itemsByVendor.size;
  let grandSubtotal = 0;
  let grandDiscount = 0;
  for (const [vendorId, data] of vendorData) {
    grandSubtotal += data.subtotal;
    grandDiscount +=
      data.defaultDiscountTotal +
      data.flashSaleDiscountTotal +
      (couponDiscountPerVendor.get(vendorId) || 0);
  }
  const grandTotal = round(grandSubtotal - grandDiscount + shippingTotal);
  const sellingTotal = round(grandSubtotal - grandDiscount);
  const grandDefaultDiscount = Array.from(vendorData.values()).reduce(
    (sum, data) => sum + data.defaultDiscountTotal,
    0,
  );
  const grandFlashSaleDiscount = Array.from(vendorData.values()).reduce(
    (sum, data) => sum + data.flashSaleDiscountTotal,
    0,
  );
  const grandCouponDiscount = Array.from(vendorData.keys()).reduce<number>(
    (sum, vendorId) => sum + (couponDiscountPerVendor.get(vendorId) || 0),
    0,
  );

  return {
    orders: detailed,
    orderCount: detailed.length,
    vendorCount: itemsByVendor.size,
    subtotal: grandSubtotal,
    totalDiscount:
      grandDefaultDiscount + grandFlashSaleDiscount + grandCouponDiscount,
    sellingTotal,
    shippingFee: shippingTotal,
    grandTotal,
    breakdown: {
      defaultDiscount: grandDefaultDiscount,
      flashSaleDiscount: grandFlashSaleDiscount,
      couponDiscount: grandCouponDiscount,
    },
    message:
      itemsByVendor.size === 1
        ? "Order placed successfully"
        : `Orders placed with ${itemsByVendor.size} vendors successfully`,
  };
};

// Helper function to validate coupon (existing implementation)
const validateCouponForUser = async (
  code: string,
  userId: number,
  orderAmount: number,
) => {
  const coupon = await prisma.coupon.findFirst({
    where: {
      code,
      isActive: true,
      startsAt: { lte: new Date() },
      expiresAt: { gte: new Date() },
      OR: [
        { usageLimit: null },
        { usedCount: { lt: prisma.coupon.fields.usageLimit } },
      ],
    },
  });

  if (!coupon) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired coupon");
  }

  if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum order amount of ${coupon.minOrderAmount} required for this coupon`,
    );
  }

  // Check per-user usage
  const userUsageCount = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userId },
  });

  if (userUsageCount >= coupon.perUserLimit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already used this coupon maximum number of times",
    );
  }

  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
  } else {
    discountAmount = Number(coupon.discountValue);
  }

  return {
    coupon,
    discountAmount: Math.min(discountAmount, orderAmount),
  };
};

// get all orders — admin
const getAllOrders = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.userId) where.userId = query.userId;

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: "insensitive" } },
      { user: { email: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        total: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            accountInfo: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        payment: {
          select: { status: true, method: true },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { total, page, limit, orders };
};

// get all orders for vendor's products — vendor
const getVendorOrders = async (
  vendorId: number,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  // Build where clause for orders through vendor's products
  const where: any = {
    items: {
      some: {
        product: {
          vendorId: vendorId,
        },
      },
    },
  };

  // Apply filters
  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: "insensitive" } },
      { user: { email: { contains: query.search, mode: "insensitive" } } },
      {
        user: {
          accountInfo: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  if (query.minAmount || query.maxAmount) {
    where.total = {
      ...(query.minAmount && { gte: query.minAmount }),
      ...(query.maxAmount && { lte: query.maxAmount }),
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        tax: true,
        total: true,
        notes: true,
        createdAt: true,
        deliveredAt: true,
        user: {
          select: {
            id: true,
            email: true,
            accountInfo: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        shippingAddress: {
          select: {
            addressLine1: true,
            addressLine2: true,
            city_district: true,
            postalCode: true,
            country: true,
            phone: true,
            fullName: true,
            landmark: true,
          },
        },
        payment: {
          select: {
            status: true,
            method: true,
            transactionId: true,
          },
        },
        items: {
          where: {
            product: {
              vendorId: vendorId,
            },
          },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            snapshot: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                vendorId: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
                vendor: {
                  select: {
                    storeName: true,
                    supportEmail: true,
                    supportPhone: true,
                    rating: true,
                    returnPolicy: true,
                  },
                },
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // Calculate summary statistics
  const summary = await prisma.order.aggregate({
    where,
    _count: {
      id: true,
    },
    _sum: {
      total: true,
    },
    _avg: {
      total: true,
    },
  });

  // Get status breakdown
  const statusBreakdown = await prisma.order.groupBy({
    by: ["status"],
    where,
    _count: {
      status: true,
    },
  });

  const statusCounts = {
    PENDING: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    REFUNDED: 0,
  };

  statusBreakdown.forEach((item) => {
    const status = item.status as keyof typeof statusCounts;
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status] = item._count.status;
    }
  });

  // Calculate revenue (excluding cancelled and refunded orders)
  const revenueAgg = await prisma.order.aggregate({
    where: {
      ...where,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    _sum: {
      total: true,
    },
  });

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    orders,
    summary: {
      totalOrders: summary._count.id,
      totalRevenue: revenueAgg._sum.total || 0,
      averageOrderValue: summary._avg.total || 0,
      pendingOrders: statusCounts.PENDING,
      processingOrders: statusCounts.PROCESSING,
      shippedOrders: statusCounts.SHIPPED,
      deliveredOrders: statusCounts.DELIVERED,
      cancelledOrders: statusCounts.CANCELLED,
    },
    statusBreakdown: statusCounts,
  };
};

// ─────────────────────────────────────────
// getMyVendorOrders — for vendor dashboard
// derives vendorId from auth token (no URL param)
// ─────────────────────────────────────────
const getMyVendorOrders = async (
  email: string,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (!user.vendorProfile)
    throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");
  // console.log(user.vendorProfile.id);
  return getVendorOrders(user.vendorProfile.id, query);
};

// get my orders — customer
const getMyOrders = async (
  email: string,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    filter?: string; // "TO_PAY" | "TO_SHIP" | "TO_RECEIVE" | "TO_REVIEW" | "ALL"
    includeCounts?: boolean; // if true, returns counts for all filters
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    select: { id: true },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: any = { userId: user.id };

  // Build filter conditions
  let filterCondition = (filter: string): any => {
    switch (filter) {
      case "TO_PAY":
        return {
          AND: [
            { status: { in: ["PENDING", "CONFIRMED"] as any } },
            {
              OR: [
                { payment: null },
                { payment: { status: { not: "SUCCESS" as any } } },
              ],
            },
          ],
        };
      case "TO_SHIP":
        return { status: { in: ["CONFIRMED", "PROCESSING"] as any } };
      case "TO_RECEIVE":
        return { status: "SHIPPED" as any };
      case "TO_REVIEW":
        return { status: "DELIVERED" as any };
      default:
        return {}; // ALL
    }
  };

  if (query.filter) {
    const cond = filterCondition(query.filter);
    Object.assign(where, cond);
  } else if (query.status) {
    where.status = query.status;
  }

  // Get paginated orders
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        total: true,
        createdAt: true,
        deliveredAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            snapshot: true,
          },
          take: 3,
        },
        payment: {
          select: { status: true, method: true },
        },
        shipment: {
          select: { trackingNumber: true, carrier: true, estimatedAt: true },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  let counts: Record<string, number> | undefined;
  if (query.includeCounts) {
    // Compute counts for each filter
    const filterKeys: FilterKey[] = [
      "ALL",
      "TO_PAY",
      "TO_SHIP",
      "TO_RECEIVE",
      "TO_REVIEW",
    ];
    const countPromises = filterKeys.map((key) => {
      const cond = key === "ALL" ? {} : filterCondition(key);
      return prisma.order.count({ where: { userId: user.id, ...cond } });
    });
    const results = await Promise.all(countPromises);
    counts = {
      ALL: results[0],
      TO_PAY: results[1],
      TO_SHIP: results[2],
      TO_RECEIVE: results[3],
      TO_REVIEW: results[4],
    };
  }

  return { total, page, limit, orders, counts };
};

// get order by id — internal helper
const getOrderById = async (
  orderId: number,
  userId: number,
  isCustomer: boolean,
) => {
  const where: any = { id: orderId };

  // customers can only see their own orders
  if (isCustomer) where.userId = userId;

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              publicId: true,
              name: true,
              slug: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
              vendor: {
                select: {
                  storeName: true,
                  supportEmail: true,
                  supportPhone: true,
                  rating: true,
                  returnPolicy: true,
                },
              },
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              price: true,
            },
          },
          review: {
            select: { id: true, rating: true },
          },
        },
      },
      shippingAddress: true,
      billingAddress: true,
      coupon: {
        select: { code: true, discountType: true, discountValue: true },
      },
      payment: true,
      shipment: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      user: {
        select: {
          email: true,
          phone: true,
          accountInfo: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  return order;
};

// get single order — customer
const getMyOrderById = async (email: string, orderId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return getOrderById(orderId, user.id, true);
};

// get single order — admin
const getOrderByIdAdmin = async (orderId: number) => {
  return getOrderById(orderId, 0, false);
};

// get order by orderNumber — customer
const getMyOrderByNumber = async (email: string, orderNumber: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  return getOrderById(order.id, user.id, true);
};

// cancel order — customer / vendor / admin
const cancelOrder = async (
  email: string,
  orderId: number,
  cancelReason: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      // For customers, restrict to their own orders; for admin/vendor we'll check separately
      ...(user.role === "CUSTOMER" ? { userId: user.id } : {}),
    },
    include: {
      items: {
        include: { product: true },
      },
      payment: true,
      coupon: true,
    },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  // ── Role‑based permission & status checks ──────────────────────────
  let allowedStatuses: string[] = [];

  if (user.role === "CUSTOMER") {
    allowedStatuses = ["PENDING", "CONFIRMED"];
    // Customer already filtered by userId, no further checks needed
  } else if (user.role === "VENDOR") {
    if (!user.vendorProfile) {
      throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");
    }
    const vendorId = user.vendorProfile.id;

    // Verify all items in this order belong to this vendor
    const allItemsBelongToVendor = order.items.every(
      (item) => item.product.vendorId === vendorId,
    );
    if (!allItemsBelongToVendor) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only cancel orders that contain only your products.",
      );
    }
    allowedStatuses = ["PENDING", "CONFIRMED", "PROCESSING"];
  } else if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    // Admin can cancel any order regardless of status
    allowedStatuses = [order.status]; // effectively allows any current status
  } else {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to cancel orders",
    );
  }

  // For non‑admin, check if current status allows cancellation
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    if (!allowedStatuses.includes(order.status)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Order cannot be cancelled at "${order.status}" stage.`,
      );
    }
  }

  // ── Proceed with cancellation in transaction ──────────────────────
  await prisma.$transaction(async (tx) => {
    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelReason,
        statusUpdatedById: user.id,
      },
    });

    // Restore stock for all items
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          change: item.quantity,
          reason:
            user.role === "CUSTOMER"
              ? "CUSTOMER_CANCELLATION"
              : user.role === "VENDOR"
                ? "VENDOR_CANCELLATION"
                : "ADMIN_CANCELLATION",
          referenceId: orderId,
        },
      });

      // Decrement totalSold
      await tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { decrement: item.quantity } },
      });
    }

    // Reverse coupon usage if applied
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });

      await tx.couponUsage.deleteMany({
        where: { couponId: order.couponId, orderId },
      });
    }

    // Add status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "CANCELLED",
        statusUpdatedById: user.id,
        note: cancelReason,
      },
    });
  });

  return `Order cancelled successfully by ${user.role.toLowerCase()}`;
};

// update order status — admin/vendor
const updateOrderStatus = async (
  email: string,
  orderId: number,
  payload: { status: string; note?: string; isPaymentReceived?: boolean },
) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shipment: true,
      payment: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  if (!order.payment) {
    throw new AppError(httpStatus.NOT_ACCEPTABLE, "Payment info not provided");
  }
  console.log(order.payment);

  // ── Vendor permission & scope check ──────────────────────────
  if (user.role === "VENDOR") {
    if (!user.vendorProfile) {
      throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");
    }

    // Ensure all items in this order belong to this vendor
    const allItemsBelongToVendor = order.items.every(
      (item) => item.product.vendorId === user.vendorProfile!.id,
    );

    if (!allItemsBelongToVendor) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only update orders that contain only your products.",
      );
    }

    // Vendor-specific status transition restrictions (same map, but we could add extra checks)
    // For now we reuse the same transition map as admin.
    // Optionally, you can define a stricter map for vendors.
  }

  // ── Admin & vendor status transition validation ──────────────
  if (!isValidStatusTransition(order.status, payload.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from "${order.status}" to "${payload.status}"`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    /** ---------------- DELIVERY LOGIC ---------------- **/
    if (payload.status === "DELIVERED") {
      const payment = await tx.payment.findUnique({ where: { orderId } });

      if (payment?.status !== "SUCCESS" && payload.isPaymentReceived !== true) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Order cannot be marked as delivered without successful payment.",
        );
      }

      // Mark payment success (COD / manual)
      if (payment && payment.status !== "SUCCESS") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCESS", paidAt: new Date() },
        });
      }

      // Update shipment delivered time
      if (order.shipment) {
        await tx.shipment.update({
          where: { id: order.shipment.id },
          data: { deliveredAt: new Date() },
        });
      }

      // ── Increment vendorDue ────────────────────────────────────────
      // Since one order = one vendor, derive vendorId from first item
      const vendorId = order.items[0]?.product?.vendorId ?? null;
      if (vendorId) {
        //retrive charge percetage of vendor per order
        const vendor = await prisma.vendorProfile.findUnique({
          where: { id: vendorId },
        });
        if (!vendor) {
          throw new AppError(httpStatus.FORBIDDEN, "Vendor Not Found");
        }
        const chargePercentage = Number(vendor.ChargePercentageOnOrder || 5);

        // Vendor earns total minus shipping fee
        const vendorEarningBeforeCharge =
          Number(order.total) - Number(order.shippingFee);

        // Marketplace commission
        const chargeAmount =
          (vendorEarningBeforeCharge * chargePercentage) / 100;

        // Final vendor earning
        const vendorEarning = Math.max(
          0,
          vendorEarningBeforeCharge - chargeAmount,
        );

        await tx.vendorProfile.update({
          where: { id: vendorId },
          data: { vendorDue: { increment: vendorEarning } },
        });

        // incriment totalSales for vendor
        await tx.vendorProfile.update({
          where: { id: vendorId },
          data: { totalSales: { increment: vendorEarningBeforeCharge } },
        });
      }
    }

    /** ---------------- CANCELLATION LOGIC ---------------- **/
    if (payload.status === "CANCELLED") {
      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      for (const item of orderItems) {
        // restore stock
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: { increment: item.quantity },
          },
        });

        // inventory log
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: item.quantity,
            reason: "ORDER_CANCELLATION",
            referenceId: orderId,
          },
        });

        // rollback total sold
        await tx.product.update({
          where: { id: item.productId },
          data: {
            totalSold: { decrement: item.quantity },
          },
        });
      }

      // rollback coupon usage
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }
    }

    /** ---------------- MAIN ORDER UPDATE ---------------- **/
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: payload.status as any,
        statusUpdatedById: user?.id ?? null,
        ...(payload.status === "DELIVERED" && {
          deliveredAt: new Date(),
        }),
      },
    });

    /** ---------------- HISTORY ---------------- **/
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: payload.status as any,
        statusUpdatedById: user?.id ?? null,
        note: payload.note ?? null,
      },
    });

    return updatedOrder;
  });

  return updated;
};

// update order status in bulk — admin/vendor
const updateOrderStatusBulk = async (
  email: string,
  payload: {
    orderIds: number[];
    status: string;
    note?: string;
    isPaymentReceived?: boolean;
  },
) => {
  const { orderIds, status, note, isPaymentReceived } = payload;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      shipment: true,
      payment: true,
      items: {
        include: { product: true },
      },
    },
  });

  // ── Vendor permission: ensure all orders contain only vendor's products ──
  if (user.role === "VENDOR") {
    if (!user.vendorProfile) {
      throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");
    }
    const vendorId = user.vendorProfile.id;

    for (const order of orders) {
      const allItemsBelongToVendor = order.items.every(
        (item) => item.product.vendorId === vendorId,
      );
      if (!allItemsBelongToVendor) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Order ${order.orderNumber} contains products from other vendors. You can only bulk update orders that contain only your products.`,
        );
      }
    }
  }

  const results = {
    success: [] as any[],
    failed: [] as any[],
    skipped: [] as any[],
  };

  for (const order of orders) {
    try {
      // status transition check
      if (!isValidStatusTransition(order.status, status)) {
        results.skipped.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: `Invalid transition ${order.status} → ${status}`,
        });
        continue;
      }
      if (!order.payment) {
        throw new AppError(
          httpStatus.NOT_ACCEPTABLE,
          "Payment info not provided",
        );
      }

      await prisma.$transaction(async (tx) => {
        /** -------- DELIVERY -------- **/
        if (status === "DELIVERED") {
          const payment = await tx.payment.findUnique({
            where: { orderId: order.id },
          });

          if (payment?.status !== "SUCCESS" && isPaymentReceived !== true) {
            throw new Error("Payment not completed");
          }

          if (payment && payment.status !== "SUCCESS") {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "SUCCESS",
                paidAt: new Date(),
              },
            });
          }

          if (order.shipment) {
            await tx.shipment.update({
              where: { id: order.shipment.id },
              data: { deliveredAt: new Date() },
            });
          }

          // ── Increment vendorDue ────────────────────────────────────────
          // Since one order = one vendor, derive vendorId from first item
          const vendorId = order.items[0]?.product?.vendorId ?? null;
          if (vendorId) {
            //retrive charge percetage of vendor per order
            const vendor = await prisma.vendorProfile.findUnique({
              where: { id: vendorId },
            });
            if (!vendor) {
              throw new AppError(httpStatus.FORBIDDEN, "Vendor Not Found");
            }
            const chargePercentage = Number(
              vendor.ChargePercentageOnOrder || 5,
            );

            // Vendor earns total minus shipping fee
            const vendorEarningBeforeCharge =
              Number(order.total) - Number(order.shippingFee);

            // Marketplace commission
            const chargeAmount =
              (vendorEarningBeforeCharge * chargePercentage) / 100;

            // Final vendor earning
            const vendorEarning = Math.max(
              0,
              vendorEarningBeforeCharge - chargeAmount,
            );

            await tx.vendorProfile.update({
              where: { id: vendorId },
              data: { vendorDue: { increment: vendorEarning } },
            });

            // incriment totalSales for vendor
            await tx.vendorProfile.update({
              where: { id: vendorId },
              data: { totalSales: { increment: vendorEarningBeforeCharge } },
            });
          }
        }

        /** -------- CANCELLATION -------- **/
        if (status === "CANCELLED") {
          const items = await tx.orderItem.findMany({
            where: { orderId: order.id },
          });

          for (const item of items) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: { increment: item.quantity },
              },
            });

            await tx.inventoryLog.create({
              data: {
                variantId: item.variantId,
                change: item.quantity,
                reason: "ORDER_CANCELLATION",
                referenceId: order.id,
              },
            });

            await tx.product.update({
              where: { id: item.productId },
              data: {
                totalSold: { decrement: item.quantity },
              },
            });
          }

          if (order.couponId) {
            await tx.coupon.update({
              where: { id: order.couponId },
              data: {
                usedCount: { decrement: 1 },
              },
            });
          }
        }

        /** -------- MAIN UPDATE -------- **/
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: status as any,
            statusUpdatedById: user?.id ?? null,
            ...(status === "DELIVERED" && {
              deliveredAt: new Date(),
            }),
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: status as any,
            statusUpdatedById: user?.id ?? null,
            note: note ?? null,
          },
        });

        results.success.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          newStatus: status,
        });

        return updatedOrder;
      });
    } catch (err: any) {
      results.failed.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: err.message,
      });
    }
  }

  return {
    total: orderIds.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    skippedCount: results.skipped.length,
    ...results,
  };
};

// get order stats — admin dashboard
const getOrderStats = async () => {
  const [total, pending, processing, delivered, cancelled, revenue] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
      prisma.order.aggregate({
        where: { status: "DELIVERED" },
        _sum: { total: true },
      }),
    ]);

  return {
    total,
    pending,
    processing,
    delivered,
    cancelled,
    totalRevenue: revenue._sum.total ?? 0,
  };
};

export const orderService = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getMyVendorOrders,
  getMyOrders,
  getMyOrderById,
  getMyOrderByNumber,
  getOrderByIdAdmin,
  cancelOrder,
  updateOrderStatus,
  updateOrderStatusBulk,
  getOrderStats,
};
