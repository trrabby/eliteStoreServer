import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import {
  initiateSSLPayment,
  validateSSLPayment,
  initiateBkashPayment,
  executeBkashPayment,
  refundBkashPayment,
  initiateNagadPayment,
  verifyNagadPayment,
  GatewayPaymentPayload,
} from "./payment.getways";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

const getOrderForPayment = async (orderId: number, userId: number) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      payment: true,
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

  if (order.status === "CANCELLED") {
    throw new AppError(httpStatus.BAD_REQUEST, "Order is cancelled");
  }

  if (order.payment?.status === "SUCCESS") {
    throw new AppError(httpStatus.BAD_REQUEST, "Order is already paid");
  }

  return order;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// initiate payment — returns gateway redirect URL or payment info
const initiatePayment = async (
  email: string,
  payload: {
    orderId: number;
    method: string;
    mobileNumber?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { accountInfo: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await getOrderForPayment(payload.orderId, user.id);

  // cash on delivery — no gateway needed
  if (payload.method === "CASH_ON_DELIVERY") {
    const payment = await prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        method: "CASH_ON_DELIVERY",
        status: "PENDING",
        amount: order.total,
        currency: "BDT",
      },
      create: {
        orderId: order.id,
        method: "CASH_ON_DELIVERY",
        status: "PENDING",
        amount: order.total,
        currency: "BDT",
      },
    });

    // check wheter verified user, if not then set order status to pending and wait for admin approval
    if (!user.isEmailVerified && !user.isPhoneVerified) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PENDING" },
      });
    } else {
      // confirm order
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "CONFIRMED",
          note: "Order confirmed with Cash on Delivery",
        },
      });
    }

    return {
      method: "CASH_ON_DELIVERY",
      payment,
      message: `Order Placed Successfully. Order is ${order.status}. Orders require admin approval for unverified users.`,
    };
  }

  const gatewayPayload: GatewayPaymentPayload = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: "BDT",
    customerName:
      `${user.accountInfo?.firstName ?? ""} ${user.accountInfo?.lastName ?? ""}`.trim(),
    customerEmail: user.email,
    customerPhone: user.phone ?? payload.mobileNumber ?? "01700000000",
    mobileNumber: payload.mobileNumber,
  };

  // create or update payment record with INITIATED status
  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      method: payload.method as any,
      status: "INITIATED",
      amount: order.total,
      currency: "BDT",
      gatewayRef: order.orderNumber,
    },
    create: {
      orderId: order.id,
      method: payload.method as any,
      status: "INITIATED",
      amount: order.total,
      currency: "BDT",
      gatewayRef: order.orderNumber,
    },
  });

  // ── SSLCommerz ──
  if (
    payload.method === "CREDIT_CARD" ||
    payload.method === "DEBIT_CARD" ||
    payload.method === "NET_BANKING"
  ) {
    const { gatewayUrl, sessionKey } = await initiateSSLPayment(gatewayPayload);

    // store session key as gatewayRef
    await prisma.payment.update({
      where: { orderId: order.id },
      data: { gatewayRef: sessionKey },
    });

    return {
      method: "SSLCOMMERZ",
      gatewayUrl,
      sessionKey,
    };
  }

  // ── bKash ──
  if (payload.method === "MOBILE_BANKING" && isBkash(payload.mobileNumber)) {
    const { bkashURL, paymentID } = await initiateBkashPayment(gatewayPayload);

    await prisma.payment.update({
      where: { orderId: order.id },
      data: { gatewayRef: paymentID },
    });

    return {
      method: "BKASH",
      bkashURL,
      paymentID,
    };
  }

  // ── Nagad ──
  if (payload.method === "MOBILE_BANKING") {
    const { callBackUrl } = await initiateNagadPayment(gatewayPayload);

    return {
      method: "NAGAD",
      callBackUrl,
    };
  }

  throw new AppError(httpStatus.BAD_REQUEST, "Unsupported payment method");
};

// detect bKash number — starts with 01 and known bKash prefixes
const isBkash = (number?: string): boolean => {
  if (!number) return false;
  // bKash numbers typically start with 013, 014, 015, 016, 017, 018, 019
  // Nagad typically 016, 017 — but we rely on user selecting the provider
  // Simple heuristic — if no number provided default to Nagad
  return number.startsWith("01");
};

// ── SSLCommerz callback handlers ──

const handleSSLSuccess = async (query: any) => {
  const { val_id, tran_id, store_amount } = query;

  // find payment by gateway ref (session key or tran_id)
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [{ gatewayRef: val_id }, { transactionId: tran_id }],
    },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  // validate with SSLCommerz
  const validation = await validateSSLPayment(val_id);

  if (!validation.isValid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: query,
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "Payment validation failed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        transactionId: validation.transactionId,
        gatewayResponse: query,
        paidAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        status: "CONFIRMED",
        note: "Payment successful via SSLCommerz",
      },
    });
  });

  return payment.order;
};

const handleSSLFail = async (query: any) => {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef: query.sessionkey },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: query,
      },
    });
  }

  return "Payment failed";
};

const handleSSLCancel = async (query: any) => {
  console.log(query);
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef: query.sessionkey },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        gatewayResponse: query,
      },
    });
  }

  return "Payment cancelled";
};

const handleSSLIpn = async (body: any) => {
  // IPN — same as success but triggered by SSLCommerz server
  if (body.status === "VALID" || body.status === "VALIDATED") {
    await handleSSLSuccess(body);
  }
  return "IPN received";
};

// ── bKash callback ──

const handleBkashCallback = async (query: {
  paymentID: string;
  status: string;
  orderId: string;
}) => {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef: query.paymentID },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (query.status !== "success") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: query,
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "bKash payment failed");
  }

  // execute payment
  const execution = await executeBkashPayment(query.paymentID);

  if (!execution.isSuccess) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: execution.response,
      },
    });
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "bKash payment execution failed",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        transactionId: execution.transactionId,
        gatewayResponse: execution.response,
        paidAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        status: "CONFIRMED",
        note: "Payment successful via bKash",
      },
    });
  });

  return payment.order;
};

// ── Nagad callback ──

const handleNagadCallback = async (query: {
  payment_ref_id: string;
  order_id: string;
  status: string;
}) => {
  const payment = await prisma.payment.findFirst({
    where: {
      order: { orderNumber: query.order_id },
    },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (query.status !== "Success") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: query,
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "Nagad payment failed");
  }

  // verify payment
  const verification = await verifyNagadPayment(query.payment_ref_id);

  if (!verification.isSuccess) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: verification.response,
      },
    });
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Nagad payment verification failed",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        transactionId: query.payment_ref_id,
        gatewayResponse: verification.response,
        paidAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        status: "CONFIRMED",
        note: "Payment successful via Nagad",
      },
    });
  });

  return payment.order;
};

// get payment by orderId
const getPaymentByOrderId = async (email: string, orderId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      order: { userId: user.id },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          status: true,
          total: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  return payment;
};

// get all payments — admin
// const getAllPayments = async (query: {
//   page?: number;
//   limit?: number;
//   status?: string;
//   method?: string;
// }) => {
//   const page = query.page ?? 1;
//   const limit = query.limit ?? 20;
//   const skip = (page - 1) * limit;

//   const where: any = {};

//   if (query.status) where.status = query.status;
//   if (query.method) where.method = query.method;

//   const [payments, total] = await Promise.all([
//     prisma.payment.findMany({
//       where,
//       skip,
//       take: limit,
//       orderBy: { createdAt: "desc" },
//       select: {
//         id: true,
//         publicId: true,
//         method: true,
//         status: true,
//         amount: true,
//         currency: true,
//         transactionId: true,
//         paidAt: true,
//         createdAt: true,
//         order: {
//           select: {
//             orderNumber: true,
//             user: {
//               select: {
//                 email: true,
//                 accountInfo: {
//                   select: { firstName: true, lastName: true },
//                 },
//               },
//             },
//           },
//         },
//       },
//     }),
//     prisma.payment.count({ where }),
//   ]);

//   return { total, page, limit, payments };
// };
const getAllPayments = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.method) where.method = query.method;

  // Date range filter
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        method: true,
        status: true,
        amount: true,
        currency: true,
        transactionId: true,
        paidAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
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
    prisma.payment.count({ where }),
  ]);

  return { total, page, limit, payments };
};

// initiate refund
const initiateRefund = async (orderId: number) => {
  const payment = await prisma.payment.findFirst({
    where: { orderId, status: "SUCCESS" },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "No successful payment found");
  }

  // bKash refund
  if (payment.method === "MOBILE_BANKING" && payment.gatewayRef) {
    const result = await refundBkashPayment(
      payment.gatewayRef,
      payment.transactionId ?? "",
      Number(payment.amount),
      payment.order.orderNumber,
    );

    if (!result.isSuccess) {
      throw new AppError(httpStatus.BAD_REQUEST, "Refund failed");
    }
  }

  // SSLCommerz — refund is manual via dashboard
  // Nagad — refund via dashboard

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundedAmount: payment.amount,
        refundedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "REFUNDED",
        note: "Payment refunded",
      },
    });
  });

  return "Refund initiated successfully";
};

export const paymentService = {
  initiatePayment,
  handleSSLSuccess,
  handleSSLFail,
  handleSSLCancel,
  handleSSLIpn,
  handleBkashCallback,
  handleNagadCallback,
  getPaymentByOrderId,
  getAllPayments,
  initiateRefund,
};
