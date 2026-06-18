import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// VENDOR — Create withdraw request
// ─────────────────────────────────────────
const createWithdrawRequest = async (
  email: string,
  payload: {
    amount: number;
    paymentMethod: string;
    description?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.vendorProfile)
    throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");

  const vendor = user.vendorProfile;

  if (Number(vendor.vendorDue) < payload.amount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient balance. Available due: ৳${Number(vendor.vendorDue).toFixed(2)}`,
    );
  }

  if (payload.amount <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Withdraw amount must be greater than zero",
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    // Decrement vendorDue immediately
    await tx.vendorProfile.update({
      where: { id: vendor.id },
      data: { vendorDue: { decrement: payload.amount } },
    });

    const created = await tx.vendorWithdrawRequest.create({
      data: {
        vendorId: vendor.id,
        userId: user.id,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        description: payload.description ?? null,
        status: "PENDING",
      },
    });

    return created;
  });

  return request;
};

// ─────────────────────────────────────────
// VENDOR — Cancel own pending request
// ─────────────────────────────────────────
const cancelWithdrawRequest = async (email: string, publicId: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.vendorProfile)
    throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");

  const request = await prisma.vendorWithdrawRequest.findUnique({
    where: { publicId },
  });

  if (!request)
    throw new AppError(httpStatus.NOT_FOUND, "Withdraw request not found");

  if (request.vendorId !== user.vendorProfile.id)
    throw new AppError(httpStatus.FORBIDDEN, "Access denied");

  if (request.status !== "PENDING")
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a request that is already ${request.status.toLowerCase()}`,
    );

  await prisma.$transaction(async (tx) => {
    // Refund amount back to vendorDue
    await tx.vendorProfile.update({
      where: { id: user.vendorProfile!.id },
      data: { vendorDue: { increment: Number(request.amount) } },
    });

    await tx.vendorWithdrawRequest.update({
      where: { publicId },
      data: { status: "CANCELLED" },
    });
  });

  return "Withdraw request cancelled. Amount has been restored to your balance.";
};

// ─────────────────────────────────────────
// VENDOR — Get own withdraw requests
// ─────────────────────────────────────────
const getMyWithdrawRequests = async (
  email: string,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    reqFrom?: string; // ISO date string (e.g., "2025-01-01")
    reqTo?: string; // ISO date string
    search?: string;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.vendorProfile)
    throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: any = { vendorId: user.vendorProfile.id };
  if (query.status) where.status = query.status;

  // Date range filter
  if (query.reqFrom || query.reqTo) {
    where.createdAt = {};
    if (query.reqFrom) {
      const from = new Date(query.reqFrom);
      if (!isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (query.reqTo) {
      const to = new Date(query.reqTo);
      if (!isNaN(to.getTime())) where.createdAt.lte = to;
    }
  }
  if (query.search) {
    console.log(query.search);
    where.OR = [
      {
        paymentMethod: { contains: query.search, mode: "insensitive" },
      },
      {
        description: { contains: query.search, mode: "insensitive" },
      },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.vendorWithdrawRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        paidBy: {
          select: {
            accountInfo: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.vendorWithdrawRequest.count({ where }),
  ]);

  const vendorDue = Number(user.vendorProfile.vendorDue);

  return { total, page, limit, vendorDue, requests };
};

// ─────────────────────────────────────────
// ADMIN — Get all withdraw requests
// ─────────────────────────────────────────
const getAllWithdrawRequests = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  reqFrom?: string;
  reqTo?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      {
        vendor: { storeName: { contains: query.search, mode: "insensitive" } },
      },
      { user: { email: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  // Date range filter
  if (query.reqFrom || query.reqTo) {
    where.createdAt = {};
    if (query.reqFrom) {
      const from = new Date(query.reqFrom);
      if (!isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (query.reqTo) {
      const to = new Date(query.reqTo);
      if (!isNaN(to.getTime())) where.createdAt.lte = to;
    }
  }

  const [requests, total] = await Promise.all([
    prisma.vendorWithdrawRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            storeName: true,
            slug: true,
            logo: true,
            vendorDue: true,
            isVerified: true,
          },
        },
        user: {
          select: {
            email: true,
            accountInfo: { select: { firstName: true, lastName: true } },
          },
        },
        paidBy: {
          select: {
            accountInfo: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.vendorWithdrawRequest.count({ where }),
  ]);

  // Aggregate stats (unchanged)
  const stats = await prisma.vendorWithdrawRequest.groupBy({
    by: ["status"],
    _count: { status: true },
    _sum: { amount: true },
  });

  const summary = stats.reduce(
    (acc, s) => ({
      ...acc,
      [s.status]: {
        count: s._count.status,
        amount: Number(s._sum.amount ?? 0),
      },
    }),
    {} as Record<string, { count: number; amount: number }>,
  );

  return { total, page, limit, summary, requests };
};

// ─────────────────────────────────────────
// ADMIN & VENDOR — Get single withdraw request
// ─────────────────────────────────────────
const getSingleWithdrawRequestById = async (
  requestId: number,
  email: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (!user.vendorProfile)
    throw new AppError(httpStatus.FORBIDDEN, "Vendor profile not found");

  const request = await prisma.vendorWithdrawRequest.findUnique({
    where: { id: requestId },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          slug: true,
          logo: true,
          vendorDue: true,
          isVerified: true,
        },
      },
      user: {
        select: {
          email: true,
          accountInfo: { select: { firstName: true, lastName: true } },
        },
      },
      paidBy: {
        select: {
          accountInfo: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Withdraw request not found");
  }

  // Permission check
  if (user.role === "VENDOR") {
    // Vendor can only see their own
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id }, // or use user id
    });
    if (!vendor || request.vendorId !== vendor.id) {
      throw new AppError(httpStatus.FORBIDDEN, "Access denied");
    }
  } else if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new AppError(httpStatus.FORBIDDEN, "Insufficient permissions");
  }

  return request;
};

// ─────────────────────────────────────────
// ADMIN — Update withdraw request status
// ─────────────────────────────────────────
const updateWithdrawStatus = async (
  adminEmail: string,
  publicId: string,
  payload: {
    status: "PROCESSING" | "PAID" | "CANCELLED";
    paidThrough?: string;
  },
) => {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail, isActive: true },
  });

  if (!admin) throw new AppError(httpStatus.NOT_FOUND, "Admin not found");

  const request = await prisma.vendorWithdrawRequest.findUnique({
    where: { publicId },
    include: { vendor: true },
  });

  if (!request) throw new AppError(httpStatus.NOT_FOUND, "Request not found");

  // Guard invalid transitions
  const allowed: Record<string, string[]> = {
    PENDING: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  if (!allowed[request.status]?.includes(payload.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from ${request.status} to ${payload.status}`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    // If admin cancels → refund vendorDue
    if (payload.status === "CANCELLED") {
      await tx.vendorProfile.update({
        where: { id: request.vendorId },
        data: { vendorDue: { increment: Number(request.amount) } },
      });
    }

    // If PAID → update lastPaymentReceived on vendor profile
    if (payload.status === "PAID") {
      if (!payload.paidThrough) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "paidThrough is required when marking as PAID",
        );
      }
      await tx.vendorProfile.update({
        where: { id: request.vendorId },
        data: { lastPaymentReceived: new Date() },
      });
    }

    const updatedRequest = await tx.vendorWithdrawRequest.update({
      where: { publicId },
      data: {
        status: payload.status,
        paidThrough: payload.paidThrough ?? null,
        paidById: payload.status === "PAID" ? admin.id : null,
      },
      include: {
        vendor: {
          select: {
            storeName: true,
            vendorDue: true,
            lastPaymentReceived: true,
          },
        },
      },
    });

    return updatedRequest;
  });

  return updated;
};

// ─────────────────────────────────────────
// ADMIN — Get single request
// ─────────────────────────────────────────
const getWithdrawRequestById = async (publicId: string) => {
  const request = await prisma.vendorWithdrawRequest.findUnique({
    where: { publicId },
    include: {
      vendor: {
        select: {
          storeName: true,
          slug: true,
          logo: true,
          vendorDue: true,
          lastPaymentReceived: true,
          supportEmail: true,
          supportPhone: true,
        },
      },
      user: {
        select: {
          email: true,
          phone: true,
          accountInfo: { select: { firstName: true, lastName: true } },
        },
      },
      paidBy: {
        select: {
          accountInfo: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!request) throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  return request;
};

export const vendorWithdrawService = {
  createWithdrawRequest,
  cancelWithdrawRequest,
  getMyWithdrawRequests,
  getAllWithdrawRequests,
  getSingleWithdrawRequestById,
  updateWithdrawStatus,
  getWithdrawRequestById,
};
