import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { validateCouponForUser } from "../Coupon/coupon.service";

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
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["OUT_FOR_DELIVERY"],
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

// create order from cart
const createOrder = async (
  email: string,
  payload: {
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
        include: { items: { include: { product: true, variant: true } } },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // validate cart
  if (!user.cart || user.cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cart is empty");
  }

  // validate shipping address belongs to user
  const shippingAddress = await prisma.address.findFirst({
    where: { id: payload.shippingAddressId, userId: user.id },
  });

  if (!shippingAddress) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipping address not found");
  }
  let billingAddress = null;
  // validate billing address if provided
  if (payload.billingAddressId) {
    billingAddress = await prisma.address.findFirst({
      where: { id: payload.billingAddressId, userId: user.id },
    });
    if (!billingAddress) {
      throw new AppError(httpStatus.NOT_FOUND, "Billing address not found");
    }
  }

  // validate all cart items — stock + status
  const issues: string[] = [];

  for (const item of user.cart.items) {
    if (item.product.status !== "ACTIVE") {
      issues.push(`"${item.product.name}" is no longer available`);
    }
    if (!item.variant.isActive) {
      issues.push(`A variant of "${item.product.name}" is unavailable`);
    }
    if (item.variant.stock < item.quantity) {
      issues.push(
        `"${item.product.name}" only has ${item.variant.stock} in stock`,
      );
    }
  }

  if (issues.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cart has issues: ${issues.join(", ")}`,
    );
  }

  // calculate subtotal
  const subtotal = user.cart.items.reduce(
    (sum, item) => sum + Number(item.variant.price) * item.quantity,
    0,
  );

  // apply coupon if provided
  let discount = 0;
  let couponId: number | null = null;

  if (payload.couponCode) {
    const couponResult = await validateCouponForUser(
      payload.couponCode,
      user.id,
      subtotal,
    );
    discount = couponResult.discountAmount;
    couponId = couponResult.coupon.id;
  }

  const shippingFee = billingAddress
    ? billingAddress.city_district?.toLowerCase() === "dhaka"
      ? 60
      : 120
    : shippingAddress?.city_district?.toLowerCase() === "dhaka"
      ? 60
      : 120; // free shipping over 2000 BDT
  // console.log(billingAddress?.city_district?.toLowerCase());
  const tax = 0; // extend when needed
  const total = subtotal - discount + shippingFee + tax;

  // create order in transaction
  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = generateOrderNumber();

    const created = await tx.order.create({
      data: {
        userId: user.id,
        orderNumber,
        shippingAddressId: payload.shippingAddressId,
        billingAddressId: payload.billingAddressId ?? null,
        status: "PENDING",
        subtotal,
        shippingFee,
        discount,
        tax,
        total,
        couponId,
        notes: payload.notes ?? null,
      },
    });

    // create order items with snapshot
    await tx.orderItem.createMany({
      data: user.cart!.items.map((item) => ({
        orderId: created.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.variant.price,
        totalPrice: Number(item.variant.price) * item.quantity,
        snapshot: {
          productName: item.product.name,
          productSlug: item.product.slug,
          variantName: item.variant.name,
          variantSku: item.variant.sku,
          price: item.variant.price,
          comparePrice: item.variant.comparePrice,
        },
      })),
    });

    // deduct stock for each variant
    for (const item of user.cart!.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });

      // log inventory change
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          change: -item.quantity,
          reason: "SALE",
          referenceId: created.id,
        },
      });

      // increment product totalSold
      await tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { increment: item.quantity } },
      });
    }

    // record coupon usage
    if (couponId) {
      await tx.couponUsage.create({
        data: {
          couponId,
          userId: user.id,
          orderId: created.id,
        },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // add initial status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: created.id,
        status: "PENDING",
        note: "Order placed successfully",
      },
    });

    // clear cart
    await tx.cartItem.deleteMany({
      where: { cartId: user.cart!.id },
    });

    return created;
  });

  // return order with full details
  return getOrderById(order.id, user.id, false);
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

// cancel order — customer
const cancelOrder = async (
  email: string,
  orderId: number,
  cancelReason: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  // only pending or confirmed can be cancelled by customer
  if (!["PENDING", "CONFIRMED"].includes(order.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Order cannot be cancelled at "${order.status}" stage`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // update order status
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelReason },
    });

    // restore stock
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          change: item.quantity,
          reason: "CANCELLATION",
          referenceId: orderId,
        },
      });

      // decrement totalSold
      await tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { decrement: item.quantity } },
      });
    }

    // reverse coupon usage if applied
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });

      await tx.couponUsage.deleteMany({
        where: { couponId: order.couponId, orderId },
      });
    }

    // add status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "CANCELLED",
        note: cancelReason,
      },
    });
  });

  return "Order cancelled successfully";
};

// update order status — admin
const updateOrderStatus = async (
  orderId: number,
  payload: { status: string; note?: string; isPaymentReceived?: boolean },
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  if (!isValidStatusTransition(order.status, payload.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from "${order.status}" to "${payload.status}"`,
    );
  }

  // if marking as delivered, check whether payment is completed
  if (payload.status === "DELIVERED") {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
    });
    // console.log(payment);
    if (payment?.status !== "SUCCESS" && payload.isPaymentReceived !== true) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Order cannot be marked as delivered without successful payment. Add isPaymentReceived flag to override if payment is received by other means.",
      );
    }
    if (payload.isPaymentReceived === true) {
      await prisma.payment.update({
        where: { orderId },
        data: { status: "SUCCESS" },
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: payload.status as any,
        ...(payload.status === "DELIVERED" && {
          deliveredAt: new Date(),
        }),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: payload.status as any,
        note: payload.note ?? null,
      },
    });

    return updatedOrder;
  });

  return updated;
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
  getMyOrders,
  getMyOrderById,
  getMyOrderByNumber,
  getOrderByIdAdmin,
  cancelOrder,
  updateOrderStatus,
  getOrderStats,
};
