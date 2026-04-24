import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// calculate how many of each item has already been returned
const getAlreadyReturnedQuantities = async (
  orderId: number,
): Promise<Map<number, number>> => {
  const existingReturns = await prisma.returnRequest.findMany({
    where: {
      orderId,
      status: { in: ["APPROVED", "COMPLETED"] },
    },
    select: { returnItems: true },
  });

  const map = new Map<number, number>();

  for (const ret of existingReturns) {
    for (const item of ret.returnItems as any[]) {
      const prev = map.get(item.orderItemId) ?? 0;
      map.set(item.orderItemId, prev + item.quantity);
    }
  }

  return map;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create return request — customer
const createReturnRequest = async (
  email: string,
  payload: {
    orderId: number;
    reason: string;
    description?: string;
    items: {
      orderItemId: number;
      quantity: number;
    }[];
  },
  images?: string[],
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // validate order belongs to user and is delivered
  const order = await prisma.order.findFirst({
    where: { id: payload.orderId, userId: user.id },
    include: {
      items: true,
      payment: true,
    },
  });

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  if (order.status !== "DELIVERED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only delivered orders can be returned. Current status: "${order.status}"`,
    );
  }

  // check return window — 2 days after delivery
  const returnWindowDays = 2;

  if (order.deliveredAt) {
    const returnDeadline = new Date(order.deliveredAt);
    returnDeadline.setDate(returnDeadline.getDate() + returnWindowDays);

    if (new Date() > returnDeadline) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Return window of ${returnWindowDays} days has expired`,
      );
    }
  }

  // check no pending return already exists for this order
  const existingPending = await prisma.returnRequest.findFirst({
    where: {
      orderId: payload.orderId,
      userId: user.id,
      status: "PENDING",
    },
  });

  if (existingPending) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A return request is already pending for this order",
    );
  }

  // validate each return item
  const alreadyReturned = await getAlreadyReturnedQuantities(payload.orderId);

  for (const retItem of payload.items) {
    const orderItem = order.items.find((i) => i.id === retItem.orderItemId);

    if (!orderItem) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Order item ${retItem.orderItemId} not found in this order`,
      );
    }

    const alreadyReturnedQty = alreadyReturned.get(retItem.orderItemId) ?? 0;
    const remainingQty = orderItem.quantity - alreadyReturnedQty;

    if (retItem.quantity > remainingQty) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot return ${retItem.quantity} — only ${remainingQty} remaining to return for item ${retItem.orderItemId}`,
      );
    }
  }

  // calculate return amount from items being returned
  const returnAmount = payload.items.reduce((sum, retItem) => {
    const orderItem = order.items.find((i) => i.id === retItem.orderItemId)!;
    return sum + Number(orderItem.unitPrice) * retItem.quantity;
  }, 0);

  const returnRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({
      data: {
        orderId: payload.orderId,
        userId: user.id,
        reason: payload.reason as any,
        description: payload.description ?? null,
        status: "PENDING",
        refundAmount: returnAmount,
        images: images ?? [],
        // store return items in JSON for granular tracking
        returnItems: payload.items,
      },
    });

    // update order status to RETURN_REQUESTED
    await tx.order.update({
      where: { id: payload.orderId },
      data: { status: "RETURN_REQUESTED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payload.orderId,
        status: "RETURN_REQUESTED",
        note: `Return requested: ${payload.reason}. Items: ${payload.items.length}`,
      },
    });

    return created;
  });

  return returnRequest;
};

// get all return requests — admin
const getAllReturnRequests = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  reason?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.reason) where.reason = query.reason;

  if (query.search) {
    where.OR = [
      {
        order: {
          orderNumber: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        user: {
          email: { contains: query.search, mode: "insensitive" },
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

  const [requests, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
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
    }),
    prisma.returnRequest.count({ where }),
  ]);

  return { total, page, limit, requests };
};

// get my return requests — customer
const getMyReturnRequests = async (
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

  const [requests, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
            items: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                snapshot: true,
              },
            },
          },
        },
      },
    }),
    prisma.returnRequest.count({ where }),
  ]);

  return { total, page, limit, requests };
};

// get single return request by id
const getReturnRequestById = async (id: number, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const returnRequest = await prisma.returnRequest.findFirst({
    where: {
      id,
      ...(!isAdmin && { userId: user.id }),
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: {
                select: {
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
                  sku: true,
                  name: true,
                },
              },
            },
          },
          payment: true,
        },
      },
      user: {
        select: {
          email: true,
          phone: true,
          accountInfo: {
            select: { firstName: true, lastName: true },
          },
          wallet: {
            select: { id: true, balance: true },
          },
        },
      },
    },
  });

  if (!returnRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Return request not found");
  }

  return returnRequest;
};

// process return — admin approves or rejects
const processReturn = async (
  returnRequestId: number,
  payload: {
    status: "APPROVED" | "REJECTED";
    refundAmount?: number;
    refundTo?: "WALLET" | "ORIGINAL_METHOD";
    note?: string;
  },
) => {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      order: {
        include: {
          items: true,
          payment: true,
          coupon: true,
        },
      },
      user: {
        include: { wallet: true },
      },
    },
  });

  if (!returnRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Return request not found");
  }

  if (returnRequest.status !== "PENDING") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Return request is already "${returnRequest.status}"`,
    );
  }

  // ── REJECTED ──────────────────────────────────
  if (payload.status === "REJECTED") {
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: "REJECTED" },
      });

      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: "DELIVERED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: returnRequest.orderId,
          status: "DELIVERED",
          note: `Return rejected: ${payload.note ?? "No reason provided"}`,
        },
      });
    });

    return "Return request rejected";
  }

  // ── APPROVED FLOW ─────────────────────────────

  const returnItems = returnRequest.returnItems as {
    orderItemId: number;
    quantity: number;
  }[];

  const refundAmount =
    payload.refundAmount ?? Number(returnRequest.refundAmount);

  const refundTo = payload.refundTo ?? "WALLET";

  // ✅ determine full vs partial return BEFORE transaction
  const isFullReturn =
    returnItems.reduce((sum, i) => sum + i.quantity, 0) ===
    returnRequest.order.items.reduce((sum, i) => sum + i.quantity, 0);

  await prisma.$transaction(async (tx) => {
    // 1. mark return request approved
    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: "APPROVED",
        refundAmount,
      },
    });

    // 2. update order status CONDITIONALLY
    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: {
        status: isFullReturn ? "RETURNED" : "DELIVERED",
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: returnRequest.orderId,
        status: isFullReturn ? "RETURNED" : "DELIVERED",
        note: isFullReturn
          ? (payload.note ?? "Full order returned")
          : (payload.note ?? "Partial return processed"),
      },
    });

    // 3. process each return item
    for (const retItem of returnItems) {
      const orderItem = returnRequest.order.items.find(
        (i) => i.id === retItem.orderItemId,
      );

      if (!orderItem) continue;

      // restore stock
      await tx.productVariant.update({
        where: { id: orderItem.variantId },
        data: { stock: { increment: retItem.quantity } },
      });

      await tx.inventoryLog.create({
        data: {
          variantId: orderItem.variantId,
          change: retItem.quantity,
          reason: "RETURN",
          referenceId: returnRequest.orderId,
        },
      });

      // update product stats
      await tx.product.update({
        where: { id: orderItem.productId },
        data: { totalSold: { decrement: retItem.quantity } },
      });

      // update vendor stats
      const product = await tx.product.findUnique({
        where: { id: orderItem.productId },
        select: { vendorId: true },
      });

      if (product?.vendorId) {
        await tx.vendorProfile.update({
          where: { id: product.vendorId },
          data: { totalSales: { decrement: retItem.quantity } },
        });
      }
    }

    // 4. reverse coupon ONLY if full return
    if (isFullReturn && returnRequest.order.couponId) {
      const coupon = await tx.coupon.findUnique({
        where: { id: returnRequest.order.couponId },
      });

      if (coupon && coupon.usedCount > 0) {
        await tx.coupon.update({
          where: { id: returnRequest.order.couponId },
          data: { usedCount: { decrement: 1 } },
        });

        await tx.couponUsage.deleteMany({
          where: {
            couponId: returnRequest.order.couponId,
            orderId: returnRequest.orderId,
          },
        });
      }
    }

    // 5. process refund
    if (refundTo === "WALLET") {
      let wallet = returnRequest.user.wallet;

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: returnRequest.userId,
            balance: 0,
            currency: "BDT",
          },
        });
      }

      // 🔥 generate internal transactionId (consistent with system)
      const transactionId = `REFUND-${returnRequest.id}-${Date.now()}`;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: refundAmount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: refundAmount,
          type: "CREDIT",
          status: "SUCCESS", // ✅ critical
          transactionId, // ✅ traceable
          gatewayRef: "", // no external gateway here
          reason: "RETURN_REFUND",
          reference: `RETURN:${returnRequest.id}`, // ✅ structured reference
          processedAt: new Date(), // ✅ lifecycle tracking
        },
      });
    }

    // 6. update payment safely (IMPORTANT FIX)
    if (returnRequest.order.payment) {
      await tx.payment.update({
        where: { id: returnRequest.order.payment.id },
        data: {
          status: isFullReturn ? "REFUNDED" : "PARTIALLY_REFUNDED",
          refundedAmount: {
            increment: refundAmount, // ✅ FIXED
          },
          refundedAt: new Date(),
        },
      });
    }

    // 7. mark order as refunded ONLY if full
    if (isFullReturn) {
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: "REFUNDED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: returnRequest.orderId,
          status: "REFUNDED",
          note:
            refundTo === "WALLET"
              ? `Refund ${refundAmount} BDT to wallet`
              : `Refund ${refundAmount} BDT via original method`,
        },
      });
    }

    // 8. finalize return request
    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: "COMPLETED" },
    });
  });

  return {
    message: "Return processed successfully",
    type: isFullReturn ? "FULL_RETURN" : "PARTIAL_RETURN",
    refundAmount,
    refundTo,
  };
};

// admin manual status update
const updateReturnStatus = async (
  id: number,
  payload: {
    status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
    note?: string;
  },
) => {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
  });

  if (!returnRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Return request not found");
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: payload?.status },
  });

  return updated;
};

// cancel return request — customer
// only if still PENDING
const cancelReturnRequest = async (email: string, id: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const returnRequest = await prisma.returnRequest.findFirst({
    where: { id, userId: user.id },
  });

  if (!returnRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Return request not found");
  }

  if (returnRequest.status !== "PENDING") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a return request that is already "${returnRequest.status}"`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    // revert order back to DELIVERED
    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: { status: "DELIVERED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: returnRequest.orderId,
        status: "DELIVERED",
        note: "Return request cancelled by customer",
      },
    });
  });

  return "Return request cancelled successfully";
};

// return request stats — admin dashboard
const getReturnStats = async () => {
  const [
    total,
    pending,
    returnedToWallet,
    rejected,
    completed,
    totalWalletRefund,
    totalDirectRefund,
  ] = await Promise.all([
    prisma.returnRequest.count(),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.returnRequest.count({ where: { status: "APPROVED" } }),
    prisma.returnRequest.count({ where: { status: "REJECTED" } }),
    prisma.returnRequest.count({ where: { status: "COMPLETED" } }),
    prisma.returnRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { refundAmount: true },
    }),
    prisma.returnRequest.aggregate({
      where: { status: "COMPLETED" },
      _sum: { refundAmount: true },
    }),
  ]);

  return {
    total,
    pending,
    returnedToWallet,
    rejected,
    completed,
    totalWalletRefund: totalWalletRefund._sum.refundAmount ?? 0,
    totalDirectRefund: totalDirectRefund._sum.refundAmount ?? 0,
  };
};

export const returnRequestService = {
  createReturnRequest,
  getAllReturnRequests,
  getMyReturnRequests,
  getReturnRequestById,
  processReturn,
  updateReturnStatus,
  cancelReturnRequest,
  getReturnStats,
};
