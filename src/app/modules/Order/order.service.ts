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
                  discounts: {
                    where: {
                      isActive: true,
                      startsAt: { lte: new Date() },
                      expiresAt: { gte: new Date() },
                    },
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

  // ── Validate shipping address ──────────────────────────
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

  // ── Calculate discounted price for each item ────────────
  interface ProcessedItem {
    cartItem: any;
    originalPrice: number;
    productDiscountPrice: number; // Price after product/flash sale discount
    productDiscountApplied: number; // Amount saved from product discount
    productDiscountType: string;
    productDiscountValue: number;
    flashSaleId?: number;
    productDiscountId?: number;
  }

  const processedItems: ProcessedItem[] = [];
  const issues: string[] = [];
  let totalProductDiscount = 0;
  let totalAfterProductDiscount = 0;

  for (const item of user.cart.items) {
    // Check product status
    if (item.product.status !== "ACTIVE")
      issues.push(`"${item.product.name}" is no longer available`);
    if (!item.variant.isActive)
      issues.push(`A variant of "${item.product.name}" is unavailable`);
    if (item.variant.stock < item.quantity)
      issues.push(
        `"${item.product.name}" only has ${item.variant.stock} in stock`,
      );

    const originalPrice = Number(item.variant.price);
    let priceAfterProductDiscount = originalPrice;
    let productDiscountApplied = 0;
    let productDiscountType = "";
    let productDiscountValue = 0;
    let flashSaleId: number | undefined;
    let productDiscountId: number | undefined;

    // Check for active flash sale first (priority 1)
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
        let salePrice = 0;
        if (flashSale.discountType === "PERCENTAGE") {
          let discountAmount =
            (originalPrice * Number(flashSale.discountValue)) / 100;
          if (flashSale.maxDiscount) {
            discountAmount = Math.min(
              discountAmount,
              Number(flashSale.maxDiscount),
            );
          }
          salePrice = originalPrice - discountAmount;
          productDiscountApplied = discountAmount;
        } else {
          // FLAT discount
          salePrice = originalPrice - Number(flashSale.discountValue);
          productDiscountApplied = Number(flashSale.discountValue);
        }

        priceAfterProductDiscount = Math.max(0, salePrice);
        productDiscountType = flashSale.discountType;
        productDiscountValue = Number(flashSale.discountValue);
        flashSaleId = flashSale.id;
      }
    }
    // If no flash sale, check for existing product discount (priority 2)
    else if (item.product.discounts && item.product.discounts.length > 0) {
      const productDiscount = item.product.discounts[0];
      let discountedPrice = 0;

      if (productDiscount.discountType === "PERCENTAGE") {
        discountedPrice =
          originalPrice -
          (originalPrice * Number(productDiscount.discountValue)) / 100;
        productDiscountApplied =
          (originalPrice * Number(productDiscount.discountValue)) / 100;
      } else {
        discountedPrice = originalPrice - Number(productDiscount.discountValue);
        productDiscountApplied = Number(productDiscount.discountValue);
      }

      priceAfterProductDiscount = Math.max(0, discountedPrice);
      productDiscountType = productDiscount.discountType;
      productDiscountValue = Number(productDiscount.discountValue);
      productDiscountId = productDiscount.id;
    }

    const itemTotalProductDiscount = productDiscountApplied * item.quantity;
    const itemTotalAfterProductDiscount =
      priceAfterProductDiscount * item.quantity;

    totalProductDiscount += itemTotalProductDiscount;
    totalAfterProductDiscount += itemTotalAfterProductDiscount;

    processedItems.push({
      cartItem: item,
      originalPrice,
      productDiscountPrice: priceAfterProductDiscount,
      productDiscountApplied,
      productDiscountType,
      productDiscountValue,
      flashSaleId,
      productDiscountId,
    });
  }

  if (issues.length)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cart has issues: ${issues.join(", ")}`,
    );

  // ── Group items by vendorId ────────────────────────────
  const itemsByVendor = new Map<number | null, typeof processedItems>();
  for (const item of processedItems) {
    const vid = item.cartItem.product.vendorId ?? null;
    if (!itemsByVendor.has(vid)) itemsByVendor.set(vid, []);
    itemsByVendor.get(vid)!.push(item);
  }

  // ── Calculate vendor subtotals after product discounts ──
  const vendorSubtotals = new Map<number | null, number>();
  for (const [vendorId, items] of itemsByVendor) {
    const vendorSubtotal = items.reduce(
      (sum, item) => sum + item.productDiscountPrice * item.cartItem.quantity,
      0,
    );
    vendorSubtotals.set(vendorId, vendorSubtotal);
  }

  // ── Apply coupon discount on total after product discounts ──
  let totalCouponDiscount = 0;
  let couponId: number | null = null;
  let couponDetails: any = null;

  if (payload.couponCode) {
    const couponResult = await validateCouponForUser(
      payload.couponCode,
      user.id,
      totalAfterProductDiscount,
    );
    totalCouponDiscount = couponResult.discountAmount;
    couponId = couponResult.coupon.id;
    couponDetails = couponResult.coupon;
  }

  // ── Calculate shipping fee ────────────────────────────
  const addressCity = (shippingAddress.city_district ?? "").toLowerCase();
  const baseShippingFee = addressCity === "dhaka" ? 70 : 130;

  // If client provided shipping fee, use it (split between vendors)
  const shippingFeePerVendor = payload.shippingFeeFromClient
    ? payload.shippingFeeFromClient / itemsByVendor.size
    : baseShippingFee;

  // ── Create one order per vendor in a single transaction ─
  const createdOrders = await prisma.$transaction(async (tx) => {
    const orders: any[] = [];

    for (const [vendorId, items] of itemsByVendor) {
      const vendorSubtotal = vendorSubtotals.get(vendorId) || 0;

      // Proportional coupon discount for this vendor's share
      const vendorCouponDiscount =
        totalAfterProductDiscount > 0
          ? (vendorSubtotal / totalAfterProductDiscount) * totalCouponDiscount
          : 0;

      // Calculate totals
      const vendorTotalAfterProductDiscount = vendorSubtotal;
      const vendorTotalAfterCoupon = vendorSubtotal - vendorCouponDiscount;
      const vendorGrandTotal = vendorTotalAfterCoupon + shippingFeePerVendor;

      // Create order
      const order = await tx.order.create({
        data: {
          userId: user.id,
          orderNumber: generateOrderNumber(),
          shippingAddressId: payload.shippingAddressId,
          billingAddressId: payload.billingAddressId ?? null,
          status: "PENDING",
          subtotal: vendorSubtotal, // After product discounts, before coupon and shipping
          shippingFee: shippingFeePerVendor,
          discount: vendorCouponDiscount, // Only coupon discount (product discounts are in subtotal)
          tax: 0,
          total: Math.max(0, vendorGrandTotal),
          couponId,
          notes: payload.notes ?? null,
        },
      });

      // Create order items with complete discount breakdown
      for (const item of items) {
        const cartItem = item.cartItem;
        const finalUnitPrice = item.productDiscountPrice;
        const totalPrice = finalUnitPrice * cartItem.quantity;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: cartItem.productId,
            variantId: cartItem.variantId,
            quantity: cartItem.quantity,
            unitPrice: finalUnitPrice,
            totalPrice: totalPrice,
            snapshot: {
              // Product info
              productName: cartItem.product.name,
              productSlug: cartItem.product.slug,
              variantName: cartItem.variant.name,
              variantSku: cartItem.variant.sku,
              vendorName: cartItem.product.vendor?.storeName ?? null,

              // Pricing breakdown
              originalPrice: item.originalPrice,
              discountedPrice: item.productDiscountPrice,
              discountApplied: item.productDiscountApplied,
              discountType: item.productDiscountType,
              discountValue: item.productDiscountValue,

              // Discount sources
              flashSaleId: item.flashSaleId,
              productDiscountId: item.productDiscountId,

              // Timestamp
              appliedAt: new Date().toISOString(),
            },
          },
        });

        // Deduct stock
        await tx.productVariant.update({
          where: { id: cartItem.variantId },
          data: { stock: { decrement: cartItem.quantity } },
        });

        // Inventory log
        await tx.inventoryLog.create({
          data: {
            variantId: cartItem.variantId,
            change: -cartItem.quantity,
            reason: "SALE",
            referenceId: order.id,
          },
        });

        // Update product total sold
        await tx.product.update({
          where: { id: cartItem.productId },
          data: { totalSold: { increment: cartItem.quantity } },
        });

        // Update flash sale sold count if applicable
        if (item.flashSaleId) {
          await tx.flashSaleItem.update({
            where: { id: item.flashSaleId },
            data: { soldCount: { increment: cartItem.quantity } },
          });
        }
      }

      // Order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          note: "Order placed successfully",
        },
      });

      orders.push(order);
    }

    // ── Coupon usage (only once per checkout) ──────────────
    if (couponId && createdOrders.length > 0) {
      await tx.couponUsage.create({
        data: {
          couponId,
          userId: user.id,
          orderId: createdOrders[0].id,
        },
      });
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // ── Clear cart ─────────────────────────────────────────
    await tx.cartItem.deleteMany({ where: { cartId: user.cart!.id } });

    return orders;
  });

  // Return each order with full details
  const detailed = await Promise.all(
    createdOrders.map((o) => getOrderById(o.id, user.id, false)),
  );

  // Calculate final summary
  const shippingTotal = shippingFeePerVendor * itemsByVendor.size;
  const totalAfterAllDiscounts =
    totalAfterProductDiscount - totalCouponDiscount;
  const grandTotalWithShipping = totalAfterAllDiscounts + shippingTotal;

  return {
    orders: detailed,
    orderCount: detailed.length,
    vendorCount: itemsByVendor.size,
    grandTotal: grandTotalWithShipping,
    breakdown: {
      subtotal: {
        original: processedItems.reduce(
          (sum, item) => sum + item.originalPrice * item.cartItem.quantity,
          0,
        ),
        afterProductDiscount: totalAfterProductDiscount,
      },
      discounts: {
        productDiscount: totalProductDiscount,
        couponDiscount: totalCouponDiscount,
        totalDiscount: totalProductDiscount + totalCouponDiscount,
      },
      shipping: shippingTotal,
      total: grandTotalWithShipping,
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
  console.log(user.vendorProfile.id);
  return getVendorOrders(user.vendorProfile.id, query);
};

// get my orders — customer
const getMyOrders = async (
  email: string,
  query: { page?: number; limit?: number; status?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: any = { userId: user.id };
  if (query.status) where.status = query.status;

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
          take: 3, // preview first 3 items
          select: {
            quantity: true,
            unitPrice: true,
            snapshot: true,
          },
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

  return { total, page, limit, orders };
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
      const payment = await tx.payment.findUnique({
        where: { orderId },
      });

      if (payment?.status !== "SUCCESS" && payload.isPaymentReceived !== true) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Order cannot be marked as delivered without successful payment. Use isPaymentReceived to override.",
        );
      }

      // mark payment success (COD or manual)
      if (payment && payment.status !== "SUCCESS") {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            paidAt: new Date(),
          },
        });
      }

      // update shipment delivered time
      if (order.shipment) {
        await tx.shipment.update({
          where: { id: order.shipment.id },
          data: { deliveredAt: new Date() },
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
