import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import {
  initiateSSLPayment,
  validateSSLPayment,
  initiateBkashPayment,
  executeBkashPayment,
} from "../Payment/payment.getways";
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

const getOrCreateWallet = async (userId: number) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0, currency: "BDT" },
    });
  }

  return wallet;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// get wallet with transaction history
const getWallet = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wallet = await getOrCreateWallet(user.id);

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { ...wallet, transactions };
};

// get full transaction history — paginated
const getTransactionHistory = async (
  email: string,
  query: {
    page?: number;
    limit?: number;
    type?: string;
    reason?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wallet = await getOrCreateWallet(user.id);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = { walletId: wallet.id };

  if (query.type) where.type = query.type;
  if (query.reason)
    where.reason = {
      contains: query.reason,
      mode: "insensitive",
    };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    balance: wallet.balance,
    total,
    page,
    limit,
    transactions,
  };
};

// ─── Add money via SSLCommerz ──────────────

const initiateAddMoneySSL = async (email: string, amount: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { accountInfo: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wallet = await getOrCreateWallet(user.id);

  const ref = `WALLET-${wallet.id}`;

  const { gatewayUrl, sessionKey, transactionId } = await initiateSSLPayment({
    orderId: wallet.id,
    orderNumber: ref,
    amount,
    currency: "BDT",
    customerName: `${user.accountInfo?.firstName ?? ""} ${
      user.accountInfo?.lastName ?? ""
    }`.trim(),
    customerEmail: user.email,
    customerPhone: user.phone ?? "01700000000",
    isAddMoney: true, // ✅ moved inside payload
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount,
      type: "CREDIT",
      status: "PENDING",
      transactionId,
      gatewayRef: sessionKey,
      reason: "SSL_TOPUP",
      reference: ref,
    },
  });

  return { gatewayUrl, sessionKey, ref, transactionId };
};

// SSL success callback for wallet topup
const handleWalletSSLSuccess = async (query: any) => {
  const { val_id, tran_id } = query;

  const validation = await validateSSLPayment(val_id);

  if (!validation.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment validation failed");
  }

  const pendingTx = await prisma.walletTransaction.findUnique({
    where: { transactionId: tran_id },
    include: { wallet: true },
  });

  if (!pendingTx) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction not found");
  }

  if (pendingTx.status === "SUCCESS") {
    throw new AppError(httpStatus.BAD_REQUEST, "Already processed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: pendingTx.walletId },
      data: { balance: { increment: Number(pendingTx.amount) } },
    });

    await tx.walletTransaction.update({
      where: { id: pendingTx.id },
      data: {
        status: "SUCCESS",
        gatewayRef: val_id, // overwrite with final validation id
        processedAt: new Date(),
        gatewayResponse: query,
      },
    });
  });

  return pendingTx.wallet;
};

// SSL fail/cancel for wallet
const handleWalletSSLFail = async (query: any) => {
  const { tran_id } = query;

  await prisma.walletTransaction.updateMany({
    where: {
      transactionId: tran_id,
      status: "PENDING",
    },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      gatewayResponse: query,
    },
  });

  return "Top-up failed";
};

// ─── Add money via bKash ──────────────────

const initiateAddMoneyBkash = async (
  email: string,
  amount: number,
  mobileNumber?: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { accountInfo: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wallet = await getOrCreateWallet(user.id);

  const ref = `WALLET-BK-${wallet.id}-${Date.now()}`;

  const { bkashURL, paymentID } = await initiateBkashPayment({
    orderId: wallet.id,
    orderNumber: ref,
    amount,
    currency: "BDT",
    customerName: `${user.accountInfo?.firstName ?? ""} ${
      user.accountInfo?.lastName ?? ""
    }`.trim(),
    customerEmail: user.email,
    customerPhone: mobileNumber ?? user.phone ?? "01700000000",
    mobileNumber,
    isAddMoney: true, // ✅ consistent usage
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount,
      type: "CREDIT",
      status: "PENDING",
      transactionId: paymentID,
      gatewayRef: paymentID,
      reason: "BKASH_TOPUP",
      reference: ref,
    },
  });

  return { bkashURL, paymentID };
};

// bKash callback for wallet topup
const handleWalletBkashCallback = async (query: {
  paymentID: string;
  status: string;
}) => {
  const txData = await prisma.walletTransaction.findUnique({
    where: { transactionId: query.paymentID },
    include: { wallet: true },
  });

  if (!txData) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction not found");
  }

  if (query.status !== "success") {
    await prisma.walletTransaction.update({
      where: { id: txData.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        gatewayResponse: query,
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "bKash payment failed");
  }

  const execution = await executeBkashPayment(query.paymentID);

  if (!execution.isSuccess) {
    await prisma.walletTransaction.update({
      where: { id: txData.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
      },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "bKash execution failed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: txData.walletId },
      data: { balance: { increment: Number(txData.amount) } },
    });

    await tx.walletTransaction.update({
      where: { id: txData.id },
      data: {
        status: "SUCCESS",
        processedAt: new Date(),
      },
    });
  });

  return txData.wallet;
};

// ─── Transfer to another user wallet ─────
const transferToWallet = async (
  senderEmail: string,
  recipientEmail: string,
  amount: number,
  note?: string,
) => {
  if (senderEmail === recipientEmail) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot transfer to your own wallet",
    );
  }

  const sender = await prisma.user.findUnique({
    where: { email: senderEmail, isActive: true },
  });

  if (!sender) {
    throw new AppError(httpStatus.NOT_FOUND, "Sender not found");
  }

  const recipient = await prisma.user.findUnique({
    where: { email: recipientEmail, isActive: true },
  });

  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, "Recipient not found");
  }

  const senderWallet = await getOrCreateWallet(sender.id);
  const recipientWallet = await getOrCreateWallet(recipient.id);

  if (Number(senderWallet.balance) < amount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient balance. Current balance: ${senderWallet.balance} BDT`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // debit sender
    await tx.wallet.update({
      where: { id: senderWallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: senderWallet.id,
        amount,
        type: "DEBIT",
        status: "SUCCESS",
        reason: "TRANSFER",
        reference: recipientEmail,
        processedAt: new Date(),
      },
    });

    // credit recipient
    await tx.wallet.update({
      where: { id: recipientWallet.id },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: recipientWallet.id,
        amount,
        type: "CREDIT",
        status: "SUCCESS",
        reason: "TRANSFER",
        reference: senderEmail,
        processedAt: new Date(),
      },
    });
  });

  return {
    message: "Transfer successful",
    amount,
    recipient: recipientEmail,
    newBalance: Number(senderWallet.balance) - amount,
  };
};

// get all wallets — admin
const getAllWallets = async (query: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.search) {
    where.user = {
      OR: [
        { email: { contains: query.search, mode: "insensitive" } },
        {
          accountInfo: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { balance: "desc" },
      include: {
        user: {
          select: {
            email: true,
            accountInfo: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    }),
    prisma.wallet.count({ where }),
  ]);

  return { total, page, limit, wallets };
};

// get all wallet transactions — admin
const getAllTransactions = async (query: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  reason?: string;
  search?: string;
  userId?: number;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.WalletTransactionWhereInput = {};

  if (query.type) {
    where.type = query.type as any;
  }

  if (query.reason) {
    where.reason = {
      contains: query.reason,
      mode: "insensitive",
    };
  }
  if (query.status) {
    where.status = query.status as any;
  }
  if (query.userId) {
    where.wallet = {
      userId: query.userId,
    };
  }
  if (query.search) {
    where.wallet = {
      user: {
        OR: [
          {
            email: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            accountInfo: {
              firstName: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
          {
            accountInfo: {
              lastName: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
        ],
      },
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                email: true,
                accountInfo: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    }),

    prisma.walletTransaction.count({ where }),
  ]);

  return {
    total,
    page,
    limit,
    transactions,
  };
};

// admin credit wallet manually
const adminCreditWallet = async (
  userId: number,
  amount: number,
  reason: string,
) => {
  const wallet = await getOrCreateWallet(userId);

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: "CREDIT",
        status: "SUCCESS", // ✅ important
        reason: "ADMIN_CREDIT",
        reference: reason,
        processedAt: new Date(), // ✅ lifecycle tracking
      },
    });
  });

  return "Wallet credited successfully";
};

// wallet stats — admin
const getWalletStats = async () => {
  const [
    totalWallets,
    totalBalance,
    totalTransactions,
    successfulTransactions,
    failedTransactions,
    totalCredits,
    totalDebits,
    topups,
    transfers,
  ] = await Promise.all([
    prisma.wallet.count(),

    prisma.wallet.aggregate({
      _sum: { balance: true },
    }),

    prisma.walletTransaction.count(),

    prisma.walletTransaction.count({
      where: { status: "SUCCESS" },
    }),

    prisma.walletTransaction.count({
      where: { status: "FAILED" },
    }),

    prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      where: {
        type: "CREDIT",
        status: "SUCCESS",
      },
    }),

    prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      where: {
        type: "DEBIT",
        status: "SUCCESS",
      },
    }),

    prisma.walletTransaction.count({
      where: {
        status: "SUCCESS",
        reason: {
          in: ["SSL_TOPUP", "BKASH_TOPUP"],
        },
      },
    }),

    prisma.walletTransaction.count({
      where: {
        reason: "TRANSFER",
      },
    }),
  ]);

  return {
    totalWallets,
    totalBalance: totalBalance._sum.balance ?? 0,
    totalTransactions,
    successfulTransactions,
    failedTransactions,
    totalCreditAmount: totalCredits._sum.amount ?? 0,
    totalDebitAmount: totalDebits._sum.amount ?? 0,
    topups,
    transfers,
  };
};

export const walletService = {
  getWallet,
  getTransactionHistory,
  initiateAddMoneySSL,
  handleWalletSSLSuccess,
  handleWalletSSLFail,
  initiateAddMoneyBkash,
  handleWalletBkashCallback,
  transferToWallet,
  getAllWallets,
  getAllTransactions,
  adminCreditWallet,
  getWalletStats,
};
