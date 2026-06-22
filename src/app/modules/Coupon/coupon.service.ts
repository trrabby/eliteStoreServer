import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ── Core validation helper ────────────────────────────────────────
export const validateCouponForUser = async (
  code: string,
  userId: number,
  orderAmount: number,
  vendorIdContext?: number | null, // ← pass vendor group id when checking scope
) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  if (!coupon.isActive)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is inactive");

  const now = new Date();
  if (now < coupon.startsAt)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is not active yet");
  if (now > coupon.expiresAt)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon has expired");

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This coupon has reached its usage limit",
    );

  const userUsageCount = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userId },
  });
  if (userUsageCount >= coupon.perUserLimit)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already used this coupon the maximum number of times",
    );

  // Vendor-scoped coupon: only applies to that vendor's items
  if (
    coupon.vendorId &&
    vendorIdContext &&
    coupon.vendorId !== vendorIdContext &&
    orderAmount > 0
  ) {
    // Skip min-order check when scoping — orderAmount may be for a different vendor
    return {
      coupon,
      discountAmount: 0,
      finalAmount: orderAmount,
      vendorScoped: true,
      couponVendorId: coupon.vendorId,
    };
  }

  if (
    coupon.minOrderAmount !== null &&
    orderAmount < Number(coupon.minOrderAmount)
  )
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum order amount of ৳${coupon.minOrderAmount} required for this coupon`,
    );

  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;
    if (
      coupon.maxDiscount !== null &&
      discountAmount > Number(coupon.maxDiscount)
    )
      discountAmount = Number(coupon.maxDiscount);
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), orderAmount);
  }

  return {
    coupon,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((orderAmount - discountAmount).toFixed(2)),
    vendorScoped: !!coupon.vendorId,
    couponVendorId: coupon.vendorId ?? null,
  };
};

// ── createCoupon ─────────────────────────────────────────────────
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
    include: { vendorProfile: true },
  });

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing)
    throw new AppError(httpStatus.BAD_REQUEST, "Coupon code already exists");

  // Vendor creates → coupon is scoped to their store
  const vendorId =
    user?.role === "VENDOR" && user?.vendorProfile
      ? user.vendorProfile.id
      : null;

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
      createdById: user?.id ?? null,
      vendorId,
    },
    include: {
      vendor: { select: { storeName: true } },
    },
  });

  return coupon;
};

// ── getAllCoupons (admin) ─────────────────────────────────────────
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
  if (query.isExpired !== undefined)
    where.expiresAt = query.isExpired ? { lt: new Date() } : { gt: new Date() };
  if (query.search)
    where.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { usages: true, orders: true } },
        vendor: { select: { storeName: true, slug: true } }, // ← NEW
        createdBy: {
          select: {
            accountInfo: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return { total, page, limit, coupons };
};

// ── getMyCoupons (vendor sees own coupons) ────────────────────────
const getMyCoupons = async (
  email: string,
  query: { page?: number; limit?: number; isActive?: boolean },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = { createdById: user.id };
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { usages: true, orders: true } },
        vendor: { select: { storeName: true } },
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return { total, page, limit, coupons };
};

// ── getCouponById ─────────────────────────────────────────────────
const getCouponById = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      vendor: { select: { storeName: true, slug: true } },
      usages: {
        take: 10,
        orderBy: { usedAt: "desc" },
        include: {
          user: {
            select: {
              email: true,
              accountInfo: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      _count: { select: { usages: true, orders: true } },
    },
  });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  return coupon;
};

// ── applyCoupon (preview at checkout — no usage recorded) ─────────
const applyCoupon = async (
  email: string,
  code: string,
  orderAmount: number,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const result = await validateCouponForUser(code, user.id, orderAmount);
  return {
    code: result.coupon.code,
    discountType: result.coupon.discountType,
    discountValue: result.coupon.discountValue,
    discountAmount: result.discountAmount,
    finalAmount: result.finalAmount,
    vendorScoped: result.vendorScoped,
    vendorId: result.couponVendorId,
    // If vendor-scoped, note applies only to that vendor
    note: result.vendorScoped
      ? "This coupon applies only to selected vendor products"
      : null,
  };
};

// ── updateCoupon ──────────────────────────────────────────────────
const updateCoupon = async (id: number, payload: any) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  return prisma.coupon.update({
    where: { id },
    data: {
      ...payload,
      ...(payload.startsAt && { startsAt: new Date(payload.startsAt) }),
      ...(payload.expiresAt && { expiresAt: new Date(payload.expiresAt) }),
    },
  });
};

// ── toggleCouponStatus ────────────────────────────────────────────
const toggleCouponStatus = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  return prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
    select: { id: true, code: true, isActive: true },
  });
};

// ── deleteCoupon ──────────────────────────────────────────────────
const deleteCoupon = async (id: number) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  if (coupon._count.orders > 0)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete — used in ${coupon._count.orders} orders. Deactivate instead.`,
    );
  await prisma.coupon.delete({ where: { id } });
  return "Coupon deleted";
};

// ── getMyCouponHistory (customer) ─────────────────────────────────
const getMyCouponHistory = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  return prisma.couponUsage.findMany({
    where: { userId: user.id },
    orderBy: { usedAt: "desc" },
    include: {
      coupon: {
        select: { code: true, discountType: true, discountValue: true },
      },
    },
  });
};

export const couponService = {
  createCoupon,
  getAllCoupons,
  getMyCoupons,
  getCouponById,
  applyCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getMyCouponHistory,
};
