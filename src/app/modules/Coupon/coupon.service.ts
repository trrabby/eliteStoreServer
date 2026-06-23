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

// ── Helper: compute per‑vendor cart aggregates ────────────────
const computeVendorCartData = (
  cartItems: any[], // from user.cart.items with full relations
) => {
  const round = (v: number) => Math.round(v);

  // Process each cart item (same as in createOrder)
  const processedItems: Array<{
    cartItem: any;
    basePrice: number;
    sellingPrice: number;
    defaultDiscount: number;
    flashSaleDiscount: number;
    priceAfterFlashSale: number;
    couponBase: number;
    finalUnitPrice: number;
    flashSaleId?: number;
  }> = [];
  const issues: string[] = [];

  for (const item of cartItems) {
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
      const flashSaleStatus = flashSale.flashSale; // already fetched with where active
      // In real code we might re-check, but we trust the relation includes active only
      if (flashSaleStatus && flashSaleStatus.isActive) {
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

  if (issues.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cart has issues: ${issues.join(", ")}`,
    );
  }

  // Group by vendor
  const itemsByVendor = new Map<number | null, typeof processedItems>();
  for (const item of processedItems) {
    const vid = item.cartItem.product.vendorId ?? null;
    if (!itemsByVendor.has(vid)) itemsByVendor.set(vid, []);
    itemsByVendor.get(vid)!.push(item);
  }

  // Compute aggregates per vendor
  const vendorData = new Map<
    number | null,
    {
      subtotal: number;
      defaultDiscountTotal: number;
      flashSaleDiscountTotal: number;
      couponBaseTotal: number;
      items: typeof processedItems;
      vendorName: string | null;
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

    // Get vendor store name from first item (all items share same vendor)
    const vendorName = items[0]?.cartItem.product.vendor?.storeName ?? null;

    vendorData.set(vendorId, {
      subtotal,
      defaultDiscountTotal,
      flashSaleDiscountTotal,
      couponBaseTotal,
      items,
      vendorName,
    });
  }

  return vendorData;
};

// ── Helpers ──────────────────────────────────────────────────────
const getUserByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    select: { id: true, role: true, vendorProfileId: true },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

// ── Coupon eligibility check ─────────────────────────────────────
export const checkCouponEligibility = async (
  email: string,
  couponCode: string,
) => {
  // 1. Fetch user with cart
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

  // 2. Compute vendor cart data (reuse logic)
  const vendorData = computeVendorCartData(user.cart.items);

  // 3. Fetch coupon
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase() },
  });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
  if (!coupon.isActive)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is inactive");

  const now = new Date();
  if (now < coupon.startsAt)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon is not active yet");
  if (now > coupon.expiresAt)
    throw new AppError(httpStatus.BAD_REQUEST, "This coupon has expired");

  // 4. Check vendor scope
  const couponVendorId = coupon.vendorId ?? null;
  const isVendorScoped = couponVendorId !== null;

  // Helper to round
  const round = (v: number) => Math.round(v);

  // 5. If vendor‑scoped, only that vendor matters
  if (isVendorScoped) {
    const vendorDataItem = vendorData.get(couponVendorId);
    if (!vendorDataItem || vendorDataItem.couponBaseTotal <= 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This coupon only applies to products from a specific vendor not in your cart",
      );
    }

    const { couponBaseTotal, vendorName } = vendorDataItem;

    // Validate coupon for that vendor's base
    const result = await validateCouponForUser(
      couponCode,
      user.id,
      couponBaseTotal,
      couponVendorId, // pass vendor context to skip min‑order if not matching (but it matches)
    );

    // Re‑throw if any validation error (shouldn't happen because we already checked)
    if (result.discountAmount <= 0 && couponBaseTotal > 0) {
      // Could be due to minOrderAmount not met? validateCouponForUser would have thrown.
      // But if it returns 0, we can still show eligibility with 0 discount?
      // Usually coupon should give some discount, but we can handle.
    }

    const discountAmount = result.discountAmount;
    const finalAmount = couponBaseTotal - discountAmount;

    return {
      eligible: true,
      message: `You are eligible to have ${result.coupon.discountValue}${
        result.coupon.discountType === "PERCENTAGE" ? "%" : " Tk"
      } coupon on ${vendorName || "this vendor"} products.`,
      details: [
        {
          vendorId: couponVendorId,
          vendorName,
          eligible: true,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
          couponBaseTotal,
          couponDiscount: discountAmount,
          finalAmount,
          note: "Coupon applies only to this vendor's products",
        },
      ],
      totalDiscount: discountAmount,
      totalOrderAmount: couponBaseTotal, // only this vendor's base
      finalAmount,
    };
  }

  // 6. Global coupon – apply to all vendors proportionally
  const totalCouponBase = Array.from(vendorData.values()).reduce(
    (sum, data) => sum + data.couponBaseTotal,
    0,
  );
  if (totalCouponBase <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Coupon cannot be applied to zero‑value order",
    );
  }

  // Validate coupon against total order amount
  const result = await validateCouponForUser(
    couponCode,
    user.id,
    totalCouponBase,
    null, // global scope
  );
  const totalAllowedDiscount = result.discountAmount;

  // Distribute total discount proportionally among vendors (matching createOrder logic)
  const vendorEntries = Array.from(vendorData.entries());
  const details: Array<{
    vendorId: number | null;
    vendorName: string | null;
    eligible: boolean;
    discountType: string;
    discountValue: number;
    couponBaseTotal: number;
    couponDiscount: number;
    finalAmount: number;
    note?: string;
  }> = [];

  let sumAssigned = 0;
  const vendorIds = vendorEntries.map(([vid]) => vid);
  for (let i = 0; i < vendorEntries.length; i++) {
    const [vid, data] = vendorEntries[i];
    const base = data.couponBaseTotal;
    if (base === 0) {
      details.push({
        vendorId: vid,
        vendorName: data.vendorName,
        eligible: true,
        discountType: result.coupon.discountType,
        discountValue: Number(result.coupon.discountValue),
        couponBaseTotal: base,
        couponDiscount: 0,
        finalAmount: 0,
        note: "No eligible items for this vendor",
      });
      continue;
    }

    let vendorDiscount: number;
    if (result.coupon.discountType === "PERCENTAGE") {
      // Calculate discount per vendor individually (capped by maxDiscount) – similar to createOrder
      let discount = (base * Number(result.coupon.discountValue)) / 100;
      if (result.coupon.maxDiscount) {
        discount = Math.min(discount, Number(result.coupon.maxDiscount));
      }
      vendorDiscount = Math.min(discount, base);
    } else {
      // Fixed amount – distribute proportionally
      const proportion = base / totalCouponBase;
      vendorDiscount = proportion * totalAllowedDiscount;
    }
    vendorDiscount = round(vendorDiscount);
    // Adjust last vendor to match totalAllowedDiscount (avoid rounding errors)
    if (i === vendorEntries.length - 1) {
      vendorDiscount = totalAllowedDiscount - sumAssigned;
    }
    // Clamp to non‑negative
    vendorDiscount = Math.max(0, vendorDiscount);
    if (vendorDiscount > base) vendorDiscount = base; // shouldn't exceed base

    const finalAmount = Math.max(0, base - vendorDiscount);
    details.push({
      vendorId: vid,
      vendorName: data.vendorName,
      eligible: true,
      discountType: result.coupon.discountType,
      discountValue: Number(result.coupon.discountValue),
      couponBaseTotal: base,
      couponDiscount: vendorDiscount,
      finalAmount,
      note: "Global coupon applied",
    });

    sumAssigned += vendorDiscount;
  }

  // Ensure sum matches totalAllowedDiscount (adjust last vendor if needed)
  if (details.length > 0) {
    const last = details[details.length - 1];
    const diff = totalAllowedDiscount - sumAssigned;
    if (Math.abs(diff) > 0.01) {
      last.couponDiscount = round(last.couponDiscount + diff);
      last.finalAmount = Math.max(
        0,
        last.couponBaseTotal - last.couponDiscount,
      );
    }
  }

  const totalDiscount = details.reduce((sum, d) => sum + d.couponDiscount, 0);
  const totalFinal = totalCouponBase - totalDiscount;

  return {
    eligible: true,
    message: `You are eligible for a ${result.coupon.discountValue}${
      result.coupon.discountType === "PERCENTAGE" ? "%" : " Tk"
    } discount across your entire order.`,
    details,
    totalDiscount,
    totalOrderAmount: totalCouponBase,
    finalAmount: totalFinal,
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

// ── getMyCoupons (vendor sees own coupons & platform wide coupons) ────────────────────────
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

  const where: any = {
    OR: [{ vendorId: user.vendorProfileId }, { vendorId: null }],
  };

  // const where: any = { createdById: user.id };
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

// ── getCouponById ───────────────────────────────────────────────
const getCouponById = async (email: string, id: number) => {
  const user = await getUserByEmail(email);

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

  // Authorization
  if (user.role !== "ADMIN") {
    if (!user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to view coupons",
      );
    }
    if (coupon.vendorId !== user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only view coupons belonging to your vendor",
      );
    }
  }

  return coupon;
};

// ── updateCoupon ────────────────────────────────────────────────
const updateCoupon = async (
  email: string,
  id: number,
  payload: {
    code?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountValue?: number;
    maxDiscount?: number | null;
    minOrderAmount?: number | null;
    startsAt?: Date | string;
    expiresAt?: Date | string;
    usageLimit?: number | null;
    perUserLimit?: number;
    isActive?: boolean;
    vendorId?: number | null;
  },
) => {
  const user = await getUserByEmail(email);

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");

  // Authorization
  if (user.role !== "ADMIN") {
    if (!user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to update coupons",
      );
    }
    if (coupon.vendorId !== user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only update coupons belonging to your vendor",
      );
    }
    // Prevent vendor from changing vendorId to another vendor or null
    if (
      payload.vendorId !== undefined &&
      payload.vendorId !== user.vendorProfileId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You cannot change the vendor association of your own coupon",
      );
    }
  }

  // Prepare data, converting date strings if provided
  const data: any = { ...payload };
  if (payload.startsAt) data.startsAt = new Date(payload.startsAt);
  if (payload.expiresAt) data.expiresAt = new Date(payload.expiresAt);

  return prisma.coupon.update({
    where: { id },
    data,
  });
};

// ── toggleCouponStatus ──────────────────────────────────────────
const toggleCouponStatus = async (email: string, id: number) => {
  const user = await getUserByEmail(email);

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");

  if (user.role !== "ADMIN") {
    if (!user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to toggle coupon status",
      );
    }
    if (coupon.vendorId !== user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only toggle coupons belonging to your vendor",
      );
    }
  }

  return prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
    select: { id: true, code: true, isActive: true },
  });
};

// ── deleteCoupon ────────────────────────────────────────────────
const deleteCoupon = async (email: string, id: number) => {
  const user = await getUserByEmail(email);

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!coupon) throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");

  if (user.role !== "ADMIN") {
    if (!user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to delete coupons",
      );
    }
    if (coupon.vendorId !== user.vendorProfileId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only delete coupons belonging to your vendor",
      );
    }
  }

  if (coupon._count.orders > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete — used in ${coupon._count.orders} orders. Deactivate instead.`,
    );
  }

  await prisma.coupon.delete({ where: { id } });
  return { message: "Coupon deleted" };
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
  checkCouponEligibility,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getMyCouponHistory,
};
