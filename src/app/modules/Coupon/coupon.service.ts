import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

// core coupon validation logic — reused in applyCoupon and order creation
export const validateCouponForUser = async (
  code: string,
  userId: number,
  orderAmount: number,
) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) {
    throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  }

  if (!coupon.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is inactive");
  }

  const now = new Date();

  if (now < coupon.startsAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is not active yet");
  }

  if (now > coupon.expiresAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon has expired");
  }

  // check total usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This coupon has reached its usage limit",
    );
  }

  // check per user usage
  const userUsageCount = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userId },
  });

  if (userUsageCount >= coupon.perUserLimit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already used this coupon the maximum number of times",
    );
  }

  // check min order amount
  if (
    coupon.minOrderAmount !== null &&
    orderAmount < Number(coupon.minOrderAmount)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
    );
  }

  // calculate discount
  let discountAmount = 0;

  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;

    // apply max discount cap for percentage
    if (
      coupon.maxDiscount !== null &&
      discountAmount > Number(coupon.maxDiscount)
    ) {
      discountAmount = Number(coupon.maxDiscount);
    }
  } else {
    // FLAT discount
    discountAmount = Number(coupon.discountValue);

    // flat discount cannot exceed order amount
    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }
  }

  return {
    coupon,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((orderAmount - discountAmount).toFixed(2)),
  };
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create coupon — admin only
const createCoupon = async (
  payload: {
    code: string;
    description?: string;
    discountType: "PERCENTAGE" | "FLAT";
    discountValue: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    usageLimit?: number;
    perUserLimit?: number;
    isActive?: boolean;
    startsAt: string;
    expiresAt: string;
  },
  email?: string,
) => {
  const code = payload.code.toUpperCase();
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });
  // console.log(user);
  const existing = await prisma.coupon.findUnique({
    where: { code },
  });

  if (existing) {
    throw new AppError(httpStatus.BAD_REQUEST, "Coupon code already exists");
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      description: payload.description ?? null,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      minOrderAmount: payload.minOrderAmount ?? null,
      maxDiscount: payload.maxDiscount ?? null,
      usageLimit: payload.usageLimit ?? null,
      perUserLimit: payload.perUserLimit ?? 1,
      isActive: payload.isActive ?? true,
      startsAt: new Date(payload.startsAt),
      expiresAt: new Date(payload.expiresAt),
      createdById: user?.id ? Number(user.id) : null,
    },
  });

  return coupon;
};

// get all coupons — admin
const getAllCoupons = async (query: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  isExpired?: boolean;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.isActive !== undefined) where.isActive = query.isActive;

  if (query.isExpired !== undefined) {
    where.expiresAt = query.isExpired
      ? { lt: new Date() } // expired
      : { gt: new Date() }; // not expired
  }

  if (query.search) {
    where.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { usages: true, orders: true },
        },
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return { total, page, limit, coupons };
};

// get single coupon by id — admin
const getCouponById = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      usages: {
        take: 10,
        orderBy: { usedAt: "desc" },
        include: {
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
      _count: {
        select: { usages: true, orders: true },
      },
    },
  });

  if (!coupon) {
    throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  }

  return coupon;
};

// apply coupon — customer, validates and returns discount info
// does NOT record usage — that happens at order creation
const applyCoupon = async (
  email: string,
  code: string,
  orderAmount: number,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const result = await validateCouponForUser(code, user.id, orderAmount);

  return {
    code: result.coupon.code,
    discountType: result.coupon.discountType,
    discountValue: result.coupon.discountValue,
    discountAmount: result.discountAmount,
    finalAmount: result.finalAmount,
  };
};

// update coupon — admin only
const updateCoupon = async (
  id: number,
  payload: {
    description?: string;
    discountType?: "PERCENTAGE" | "FLAT";
    discountValue?: number;
    minOrderAmount?: number | null;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    perUserLimit?: number;
    isActive?: boolean;
    startsAt?: string;
    expiresAt?: string;
  },
) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      ...payload,
      ...(payload.startsAt && { startsAt: new Date(payload.startsAt) }),
      ...(payload.expiresAt && { expiresAt: new Date(payload.expiresAt) }),
    },
  });

  return updated;
};

// toggle active status — admin
const toggleCouponStatus = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
    select: {
      id: true,
      code: true,
      isActive: true,
    },
  });

  return updated;
};

// delete coupon — admin only
const deleteCoupon = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true } },
    },
  });

  if (!coupon) {
    throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  }

  // block if coupon has been used in orders
  if (coupon._count.orders > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete — this coupon has been used in ${coupon._count.orders} orders. Deactivate it instead.`,
    );
  }

  await prisma.coupon.delete({ where: { id } });

  return "Coupon deleted successfully";
};

// get my coupon usage history — customer
const getMyCouponHistory = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const usages = await prisma.couponUsage.findMany({
    where: { userId: user.id },
    orderBy: { usedAt: "desc" },
    include: {
      coupon: {
        select: {
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  });

  return usages;
};

export const couponService = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  applyCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getMyCouponHistory,
};
