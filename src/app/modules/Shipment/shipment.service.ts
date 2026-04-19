import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import {
  createSteadfastBulkOrders,
  getSteadfastStatusByConsignmentId,
  getSteadfastBalance,
  mapSteadfastStatus,
  SteadfastOrderPayload,
} from "./shipment.steadfast";

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create manual shipment — admin
const createShipment = async (payload: {
  orderId: number;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedAt?: string;
}) => {
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { shipment: true, payment: true },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  if (!["CONFIRMED", "PROCESSING"].includes(order.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Order must be CONFIRMED or PROCESSING to ship. Current: "${order.status}"`,
    );
  }

  if (
    order.payment &&
    order.payment.method !== "CASH_ON_DELIVERY" &&
    order.payment.status !== "SUCCESS"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment must be completed before shipping",
    );
  }

  if (order.shipment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Shipment already exists. Update it instead.",
    );
  }

  const trackingExists = await prisma.shipment.findFirst({
    where: { trackingNumber: payload.trackingNumber },
  });

  if (trackingExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Tracking number already in use",
    );
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: payload.orderId,
        carrier: payload.carrier,
        trackingNumber: payload.trackingNumber,
        trackingUrl: payload.trackingUrl ?? null,
        estimatedAt: payload.estimatedAt ? new Date(payload.estimatedAt) : null,
        shippedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payload.orderId },
      data: { status: "SHIPPED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payload.orderId,
        status: "SHIPPED",
        note: `Shipped via ${payload.carrier}. Tracking: ${payload.trackingNumber}`,
      },
    });

    return created;
  });

  return shipment;
};

// ─────────────────────────────────────────
// STEADFAST
// ─────────────────────────────────────────

// send bulk orders to steadfast
const createSteadfastShipments = async (orderIds: number[]) => {
  // fetch all orders with required data
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      status: { in: ["CONFIRMED", "PROCESSING"] },
    },
    include: {
      shipment: true,
      shippingAddress: true,
      payment: true,
      user: {
        select: {
          phone: true,
          accountInfo: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!orders.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No eligible orders found. Orders must be CONFIRMED or PROCESSING.",
    );
  }

  // separate already shipped orders
  const alreadyShipped = orders
    .filter((o) => o.shipment)
    .map((o) => o.orderNumber);

  const eligibleOrders = orders.filter((o) => !o.shipment);

  if (!eligibleOrders.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `All orders already have shipments: ${alreadyShipped.join(", ")}`,
    );
  }

  // build steadfast payloads
  const steadfastPayloads: SteadfastOrderPayload[] = eligibleOrders.map(
    (order) => ({
      invoice: order.orderNumber,
      recipient_name:
        `${order.user.accountInfo?.firstName ?? ""} ${order.user.accountInfo?.lastName ?? ""}`.trim(),
      recipient_phone: order.shippingAddress.phone,
      recipient_address: [
        order.shippingAddress.addressLine1,
        order.shippingAddress.addressLine2,
        order.shippingAddress.city_district,
      ]
        .filter(Boolean)
        .join(", "),
      // COD amount — 0 for prepaid orders
      cod_amount:
        order.payment?.method === "CASH_ON_DELIVERY" ? Number(order.total) : 0,
      note: order.notes ?? undefined,
    }),
  );

  // send to steadfast
  const { success, failed } =
    await createSteadfastBulkOrders(steadfastPayloads);

  const results = {
    successCount: success.length,
    failedCount: failed.length,
    alreadyShipped,
    failed,
    created: [] as any[],
  };

  // save successful shipments to DB
  for (const item of success) {
    const order = eligibleOrders.find((o) => o.orderNumber === item.invoice);

    if (!order) continue;

    await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: "Steadfast",
          trackingNumber: item.consignment_id,
          trackingUrl: `https://steadfast.com.bd/t/${item.consignment_id}`,
          shippedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "SHIPPED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "SHIPPED",
          note: `Shipped via Steadfast. Consignment: ${item.consignment_id}`,
        },
      });

      results.created.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        consignmentId: item.consignment_id,
        trackingCode: item.tracking_code,
        shipmentId: shipment.id,
      });
    });
  }

  return results;
};

// sync steadfast statuses for given shipments
const syncSteadfastStatuses = async (shipmentIds: number[]) => {
  const shipments = await prisma.shipment.findMany({
    where: {
      id: { in: shipmentIds },
      carrier: "Steadfast",
    },
    include: { order: true },
  });

  if (!shipments.length) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No Steadfast shipments found for given IDs",
    );
  }

  const results = {
    updated: [] as any[],
    skipped: [] as any[],
    failed: [] as any[],
  };

  for (const shipment of shipments) {
    try {
      const { status } = await getSteadfastStatusByConsignmentId(
        shipment.trackingNumber!,
      );

      const mappedStatus = mapSteadfastStatus(status);

      // skip if status hasn't changed or is unmappable
      if (!mappedStatus || mappedStatus === shipment.order.status) {
        results.skipped.push({
          shipmentId: shipment.id,
          orderNumber: shipment.order.orderNumber,
          currentStatus: shipment.order.status,
          steadfastStatus: status,
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // update order status
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: mappedStatus as any },
        });

        // update shipment if delivered
        if (mappedStatus === "DELIVERED") {
          await tx.shipment.update({
            where: { id: shipment.id },
            data: { deliveredAt: new Date() },
          });

          // update order deliveredAt
          await tx.order.update({
            where: { id: shipment.orderId },
            data: { deliveredAt: new Date() },
          });

          // COD payment confirmation
          const payment = await tx.payment.findFirst({
            where: {
              orderId: shipment.orderId,
              method: "CASH_ON_DELIVERY",
              status: "PENDING",
            },
          });

          if (payment) {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "SUCCESS",
                paidAt: new Date(),
              },
            });
          }
        }

        // restore stock on cancellation
        if (mappedStatus === "CANCELLED") {
          const orderItems = await tx.orderItem.findMany({
            where: { orderId: shipment.orderId },
          });

          for (const item of orderItems) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });

            await tx.inventoryLog.create({
              data: {
                variantId: item.variantId,
                change: item.quantity,
                reason: "STEADFAST_CANCELLATION",
                referenceId: shipment.orderId,
              },
            });

            await tx.product.update({
              where: { id: item.productId },
              data: { totalSold: { decrement: item.quantity } },
            });
          }

          // reverse coupon usage
          const order = await tx.order.findUnique({
            where: { id: shipment.orderId },
          });

          if (order?.couponId) {
            await tx.coupon.update({
              where: { id: order.couponId },
              data: { usedCount: { decrement: 1 } },
            });
          }
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: shipment.orderId,
            status: mappedStatus as any,
            note: `Status synced from Steadfast: ${status}`,
          },
        });
      });

      results.updated.push({
        shipmentId: shipment.id,
        orderNumber: shipment.order.orderNumber,
        previousStatus: shipment.order.status,
        newStatus: mappedStatus,
        steadfastStatus: status,
      });
    } catch (err: any) {
      results.failed.push({
        shipmentId: shipment.id,
        orderNumber: shipment.order.orderNumber,
        error: err.message,
      });
    }
  }

  return results;
};

// get steadfast account balance — admin
const getSteadfastAccountBalance = async () => {
  const balance = await getSteadfastBalance();
  return balance;
};

// ─────────────────────────────────────────
// BULK STATUS UPDATES
// ─────────────────────────────────────────

// mark multiple shipments as out for delivery
const markOutForDelivery = async (shipmentIds: number[]) => {
  const shipments = await prisma.shipment.findMany({
    where: { id: { in: shipmentIds } },
    include: { order: true },
  });

  if (!shipments.length) {
    throw new AppError(httpStatus.NOT_FOUND, "No shipments found");
  }

  const results = {
    updated: [] as any[],
    skipped: [] as any[],
  };

  for (const shipment of shipments) {
    if (shipment.order.status !== "SHIPPED") {
      results.skipped.push({
        shipmentId: shipment.id,
        orderNumber: shipment.order.orderNumber,
        currentStatus: shipment.order.status,
        reason: "Order must be SHIPPED",
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { status: "OUT_FOR_DELIVERY" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: shipment.orderId,
          status: "OUT_FOR_DELIVERY",
          note: "Package is out for delivery",
        },
      });
    });

    results.updated.push({
      shipmentId: shipment.id,
      orderNumber: shipment.order.orderNumber,
    });
  }

  return {
    updatedCount: results.updated.length,
    skippedCount: results.skipped.length,
    ...results,
  };
};

// mark multiple shipments as delivered
const markDelivered = async (shipmentIds: number[], deliveredAt?: string) => {
  const shipments = await prisma.shipment.findMany({
    where: { id: { in: shipmentIds } },
    include: { order: { include: { payment: true } } },
  });

  if (!shipments.length) {
    throw new AppError(httpStatus.NOT_FOUND, "No shipments found");
  }

  const deliveryDate = deliveredAt ? new Date(deliveredAt) : new Date();

  const results = {
    updated: [] as any[],
    skipped: [] as any[],
  };

  for (const shipment of shipments) {
    if (!["SHIPPED", "OUT_FOR_DELIVERY"].includes(shipment.order.status)) {
      results.skipped.push({
        shipmentId: shipment.id,
        orderNumber: shipment.order.orderNumber,
        currentStatus: shipment.order.status,
        reason: "Order must be SHIPPED or OUT_FOR_DELIVERY",
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { deliveredAt: deliveryDate },
      });

      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          status: "DELIVERED",
          deliveredAt: deliveryDate,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: shipment.orderId,
          status: "DELIVERED",
          note: "Package delivered successfully",
        },
      });

      // COD payment confirmation on delivery
      const codPayment = shipment.order.payment;

      if (
        codPayment &&
        codPayment.method === "CASH_ON_DELIVERY" &&
        codPayment.status === "PENDING"
      ) {
        await tx.payment.update({
          where: { id: codPayment.id },
          data: {
            status: "SUCCESS",
            paidAt: deliveryDate,
          },
        });
      }
    });

    results.updated.push({
      shipmentId: shipment.id,
      orderNumber: shipment.order.orderNumber,
    });
  }

  return {
    updatedCount: results.updated.length,
    skippedCount: results.skipped.length,
    ...results,
  };
};

// ─────────────────────────────────────────
// READ SERVICES
// ─────────────────────────────────────────

const getShipmentByOrderId = async (orderId: number, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(!isAdmin && { userId: user.id }),
    },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          orderNumber: true,
          status: true,
          statusHistory: {
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              note: true,
              createdAt: true,
            },
          },
          user: {
            select: {
              email: true,
              accountInfo: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!shipment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Shipment not found for this order",
    );
  }

  return shipment;
};

const trackByTrackingNumber = async (trackingNumber: string) => {
  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber },
    select: {
      id: true,
      carrier: true,
      trackingNumber: true,
      trackingUrl: true,
      shippedAt: true,
      estimatedAt: true,
      deliveredAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          statusHistory: {
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              note: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!shipment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No shipment found with this tracking number",
    );
  }

  return shipment;
};

const getAllShipments = async (query: {
  page?: number;
  limit?: number;
  carrier?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.carrier) {
    where.carrier = { contains: query.carrier, mode: "insensitive" };
  }

  if (query.search) {
    where.OR = [
      { trackingNumber: { contains: query.search, mode: "insensitive" } },
      {
        order: {
          orderNumber: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.shippedAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        carrier: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
        estimatedAt: true,
        deliveredAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            status: true,
            user: {
              select: {
                email: true,
                accountInfo: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return { total, page, limit, shipments };
};

const updateShipment = async (
  shipmentId: number,
  payload: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedAt?: string;
  },
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (
    payload.trackingNumber &&
    payload.trackingNumber !== shipment.trackingNumber
  ) {
    const exists = await prisma.shipment.findFirst({
      where: { trackingNumber: payload.trackingNumber },
    });

    if (exists) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Tracking number already in use",
      );
    }
  }

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      ...payload,
      ...(payload.estimatedAt && {
        estimatedAt: new Date(payload.estimatedAt),
      }),
    },
  });

  return updated;
};

// shipment stats — admin dashboard
const getShipmentStats = async () => {
  const [
    total,
    shipped,
    outForDelivery,
    delivered,
    steadfastCount,
    manualCount,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({
      where: { order: { status: "SHIPPED" } },
    }),
    prisma.shipment.count({
      where: { order: { status: "OUT_FOR_DELIVERY" } },
    }),
    prisma.shipment.count({
      where: { deliveredAt: { not: null } },
    }),
    prisma.shipment.count({
      where: { carrier: "Steadfast" },
    }),
    prisma.shipment.count({
      where: { carrier: { not: "Steadfast" } },
    }),
  ]);

  return {
    total,
    shipped,
    outForDelivery,
    delivered,
    pending: total - delivered,
    byCourier: {
      steadfast: steadfastCount,
      manual: manualCount,
    },
  };
};

export const shipmentService = {
  createShipment,
  createSteadfastShipments,
  syncSteadfastStatuses,
  getSteadfastAccountBalance,
  getShipmentByOrderId,
  trackByTrackingNumber,
  getAllShipments,
  updateShipment,
  markOutForDelivery,
  markDelivered,
  getShipmentStats,
};
