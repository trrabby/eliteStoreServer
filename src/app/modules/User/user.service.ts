import bcrypt from "bcrypt";
import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { Role } from "@prisma/client";
// services/user.service.ts
import { Prisma } from "@prisma/client";
import { DateRange, UserFilter } from "../../../types/userFilters";

// Helper to add date range
const addDateRange = (where: any, field: string, range?: DateRange) => {
  if (range?.from || range?.to) {
    where[field] = {};
    if (range.from) where[field].gte = new Date(range.from);
    if (range.to) where[field].lte = new Date(range.to);
  }
};

// services/user.service.ts - part 1

const buildDirectWhere = (filter: UserFilter): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  // Basic scalar fields
  if (filter.email)
    where.email = { contains: filter.email, mode: "insensitive" };
  if (filter.phone)
    where.phone = { contains: filter.phone, mode: "insensitive" };
  if (filter.role)
    where.role = Array.isArray(filter.role) ? { in: filter.role } : filter.role;
  if (filter.isBanned !== undefined) where.isBanned = filter.isBanned;
  if (filter.isEmailVerified !== undefined)
    where.isEmailVerified = filter.isEmailVerified;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;

  // Date ranges
  if (filter.createdAtFrom || filter.createdAtTo) {
    where.createdAt = {};
    if (filter.createdAtFrom)
      where.createdAt.gte = new Date(filter.createdAtFrom);
    if (filter.createdAtTo) where.createdAt.lte = new Date(filter.createdAtTo);
  }
  if (filter.lastLoginFrom || filter.lastLoginTo) {
    where.lastLoginAt = {};
    if (filter.lastLoginFrom)
      where.lastLoginAt.gte = new Date(filter.lastLoginFrom);
    if (filter.lastLoginTo)
      where.lastLoginAt.lte = new Date(filter.lastLoginTo);
  }

  // AccountInfo
  if (
    filter.firstName ||
    filter.lastName ||
    filter.displayName ||
    filter.gender
  ) {
    where.accountInfo = {};
    if (filter.firstName)
      where.accountInfo.firstName = {
        contains: filter.firstName,
        mode: "insensitive",
      };
    if (filter.lastName)
      where.accountInfo.lastName = {
        contains: filter.lastName,
        mode: "insensitive",
      };
    if (filter.displayName)
      where.accountInfo.displayName = {
        contains: filter.displayName,
        mode: "insensitive",
      };
    if (filter.gender) where.accountInfo.gender = filter.gender;
  }

  // Date of birth range
  if (filter.dobFrom || filter.dobTo) {
    where.accountInfo = where.accountInfo || {};
    where.accountInfo.dateOfBirth = {};
    if (filter.dobFrom)
      where.accountInfo.dateOfBirth.gte = new Date(filter.dobFrom);
    if (filter.dobTo)
      where.accountInfo.dateOfBirth.lte = new Date(filter.dobTo);
  }

  // Age filters (convert age to dob range)
  if (filter.ageMin !== undefined || filter.ageMax !== undefined) {
    const today = new Date();
    const minDate =
      filter.ageMax !== undefined
        ? new Date(
            today.getFullYear() - filter.ageMax,
            today.getMonth(),
            today.getDate(),
          )
        : undefined;
    const maxDate =
      filter.ageMin !== undefined
        ? new Date(
            today.getFullYear() - filter.ageMin,
            today.getMonth(),
            today.getDate(),
          )
        : undefined;
    where.accountInfo = where.accountInfo || {};
    where.accountInfo.dateOfBirth = {};
    if (minDate) where.accountInfo.dateOfBirth.gte = minDate;
    if (maxDate) where.accountInfo.dateOfBirth.lte = maxDate;
  }

  // Address filters
  if (
    filter.addressCityDistrict ||
    filter.addressCountry ||
    filter.addressPostalCode ||
    filter.addressType ||
    filter.addressIsDefault !== undefined
  ) {
    where.addresses = { some: {} };
    const addressSome = where.addresses.some!;
    if (filter.addressCityDistrict)
      addressSome.city_district = {
        contains: filter.addressCityDistrict,
        mode: "insensitive",
      };
    if (filter.addressCountry)
      addressSome.country = {
        contains: filter.addressCountry,
        mode: "insensitive",
      };
    if (filter.addressPostalCode)
      addressSome.postalCode = {
        contains: filter.addressPostalCode,
        mode: "insensitive",
      };
    if (filter.addressType) addressSome.type = filter.addressType;
    if (filter.addressIsDefault !== undefined)
      addressSome.isDefault = filter.addressIsDefault;
  }

  // Order status existence
  if (filter.hasDeliveredOrders !== undefined) {
    where.orders = filter.hasDeliveredOrders
      ? { some: { status: "DELIVERED" } }
      : { none: { status: "DELIVERED" } };
  }
  if (filter.hasCancelledOrders !== undefined) {
    where.orders = filter.hasCancelledOrders
      ? { some: { status: "CANCELLED" } }
      : { none: { status: "CANCELLED" } };
  }
  if (filter.hasReturnedOrders !== undefined) {
    where.returnRequests = filter.hasReturnedOrders
      ? { some: {} }
      : { none: {} };
  }
  if (filter.orderStatus) {
    const statuses = Array.isArray(filter.orderStatus)
      ? filter.orderStatus
      : [filter.orderStatus];
    where.orders = { some: { status: { in: statuses } } };
  }

  // Return request status
  if (filter.returnRequestStatus) {
    const statuses = Array.isArray(filter.returnRequestStatus)
      ? filter.returnRequestStatus
      : [filter.returnRequestStatus];
    where.returnRequests = { some: { status: { in: statuses } } };
  }

  // Product interactions
  if (filter.productInCart && filter.productInCart.length > 0) {
    where.cart = {
      items: { some: { productId: { in: filter.productInCart } } },
    };
  }
  if (filter.productInWishlist && filter.productInWishlist.length > 0) {
    where.wishlist = {
      items: { some: { productId: { in: filter.productInWishlist } } },
    };
  }
  if (filter.orderedProduct && filter.orderedProduct.length > 0) {
    where.orders = {
      some: { items: { some: { productId: { in: filter.orderedProduct } } } },
    };
  }
  if (filter.reviewedProduct && filter.reviewedProduct.length > 0) {
    where.reviews = { some: { productId: { in: filter.reviewedProduct } } };
  }

  // Vendor profile filters
  if (
    filter.isVendor !== undefined ||
    filter.vendorVerified !== undefined ||
    filter.vendorStoreName
  ) {
    where.vendorProfile = {};
    if (filter.isVendor !== undefined) {
      // We cannot use isNot: null in some Prisma versions; use OR with null check
      if (filter.isVendor) where.vendorProfile = { isNot: null };
      else where.vendorProfile = { is: null };
    }
    if (filter.vendorVerified !== undefined)
      where.vendorProfile.isVerified = filter.vendorVerified;
    if (filter.vendorStoreName)
      where.vendorProfile.storeName = {
        contains: filter.vendorStoreName,
        mode: "insensitive",
      };
  }

  // Coupon usage
  if (filter.usedCouponCode) {
    where.couponsUsed = {
      some: {
        coupon: {
          code: { contains: filter.usedCouponCode, mode: "insensitive" },
        },
      },
    };
  }
  if (filter.usedCouponId) {
    where.couponsUsed = { some: { couponId: filter.usedCouponId } };
  }

  // Review existence
  if (filter.hasWrittenReviews !== undefined) {
    where.reviews = filter.hasWrittenReviews ? { some: {} } : { none: {} };
  }

  // Session
  if (filter.hasActiveSession !== undefined) {
    where.sessions = filter.hasActiveSession
      ? { some: { expiresAt: { gt: new Date() } } }
      : { none: {} };
  }

  // Search (broad)
  if (filter.search) {
    const term = filter.search.trim();
    where.OR = [
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { accountInfo: { firstName: { contains: term, mode: "insensitive" } } },
      { accountInfo: { lastName: { contains: term, mode: "insensitive" } } },
      { accountInfo: { displayName: { contains: term, mode: "insensitive" } } },
      { vendorProfile: { storeName: { contains: term, mode: "insensitive" } } },
    ];
  }

  return where;
};

// services/user.service.ts - part 2

const getMatchingUserIdsFromAggregates = async (
  filter: UserFilter,
): Promise<{ userIds: number[] }> => {
  const conditions: string[] = [];
  const params: any[] = [];

  // Helper to add a condition with parameters
  const addCondition = (sql: string, values: any[]) => {
    conditions.push(sql);
    params.push(...values);
  };

  // Order count
  if (
    filter.orderCountMin !== undefined ||
    filter.orderCountMax !== undefined
  ) {
    const min = filter.orderCountMin ?? 0;
    const max = filter.orderCountMax ?? 999999;
    addCondition(
      `(SELECT COUNT(*) FROM orders WHERE orders."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Order total spent
  if (
    filter.orderTotalSpentMin !== undefined ||
    filter.orderTotalSpentMax !== undefined
  ) {
    const min = filter.orderTotalSpentMin ?? 0;
    const max = filter.orderTotalSpentMax ?? 999999999;
    addCondition(
      `(SELECT COALESCE(SUM(total), 0) FROM orders WHERE orders."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Return request count
  if (
    filter.returnRequestCountMin !== undefined ||
    filter.returnRequestCountMax !== undefined
  ) {
    const min = filter.returnRequestCountMin ?? 0;
    const max = filter.returnRequestCountMax ?? 999999;
    addCondition(
      `(SELECT COUNT(*) FROM return_requests WHERE return_requests."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Review count
  if (
    filter.reviewCountMin !== undefined ||
    filter.reviewCountMax !== undefined
  ) {
    const min = filter.reviewCountMin ?? 0;
    const max = filter.reviewCountMax ?? 999999;
    addCondition(
      `(SELECT COUNT(*) FROM reviews WHERE reviews."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Vendor rating
  if (
    filter.vendorRatingMin !== undefined ||
    filter.vendorRatingMax !== undefined
  ) {
    const min = filter.vendorRatingMin ?? 0;
    const max = filter.vendorRatingMax ?? 5;
    addCondition(
      `(SELECT rating FROM vendor_profiles WHERE vendor_profiles."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Vendor total sales
  if (
    filter.vendorTotalSalesMin !== undefined ||
    filter.vendorTotalSalesMax !== undefined
  ) {
    const min = filter.vendorTotalSalesMin ?? 0;
    const max = filter.vendorTotalSalesMax ?? 999999;
    addCondition(
      `(SELECT "totalSales" FROM vendor_profiles WHERE vendor_profiles."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Review rating average
  if (
    filter.reviewRatingMin !== undefined ||
    filter.reviewRatingMax !== undefined
  ) {
    const min = filter.reviewRatingMin ?? 1;
    const max = filter.reviewRatingMax ?? 5;
    addCondition(
      `(SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviews."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  // Wallet balance
  if (
    filter.walletBalanceMin !== undefined ||
    filter.walletBalanceMax !== undefined
  ) {
    const min = filter.walletBalanceMin ?? 0;
    const max = filter.walletBalanceMax ?? 999999;
    addCondition(
      `(SELECT balance FROM wallets WHERE wallets."userId" = users.id) BETWEEN $${params.length + 1} AND $${params.length + 2}`,
      [min, max],
    );
  }

  if (conditions.length === 0) return { userIds: [] };

  // Build final SQL
  const sql = `
    SELECT id FROM users
    WHERE ${conditions.join(" AND ")}
  `;

  // Execute with parameters
  const result = (await prisma.$queryRaw`${Prisma.sql([sql, ...params])}`) as {
    id: number;
  }[];
  return { userIds: result.map((r) => r.id) };
};

// Register user
const registerUser = async (payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) => {
  // console.log(payload.email);
  const isUserExists = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (isUserExists) {
    throw new AppError(httpStatus.BAD_REQUEST, "Account already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: payload.email,
        password: hashedPassword,
        phone: payload.phone ?? null,
        role: Role.CUSTOMER,
      },
    });

    await tx.accountInfo.create({
      data: {
        userId: user.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    });

    return user;
  });

  const { password, ...userWithoutPassword } = result;
  return userWithoutPassword;
};

const getAllUsers = async (filter: UserFilter) => {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 15;
  const skip = (page - 1) * limit;

  // Get user IDs from aggregate filters
  const { userIds: aggUserIds } =
    await getMatchingUserIdsFromAggregates(filter);

  // Build direct where clause
  const where = buildDirectWhere(filter);
  if (aggUserIds.length > 0) {
    where.id = { in: aggUserIds };
  }

  // Sorting
  const sortOrder = filter.sortOrder || "desc";
  const sortMap: Record<string, any> = {
    createdAt: { createdAt: sortOrder },
    lastLoginAt: { lastLoginAt: sortOrder },
    email: { email: sortOrder },
    phone: { phone: sortOrder },
    role: { role: sortOrder },
    displayName: { accountInfo: { displayName: sortOrder } },
    firstName: { accountInfo: { firstName: sortOrder } },
    lastName: { accountInfo: { lastName: sortOrder } },
    gender: { accountInfo: { gender: sortOrder } },
  };
  const sortBy = filter.sortBy || "createdAt";
  const orderBy = sortMap[sortBy] || { createdAt: sortOrder };

  // Select fields
  const select = {
    id: true,
    publicId: true,
    email: true,
    phone: true,
    role: true,
    isEmailVerified: true,
    isBanned: true,
    lastLoginAt: true,
    createdAt: true,
    accountInfo: {
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        gender: true,
        dateOfBirth: true,
      },
    },
    vendorProfile: {
      select: {
        storeName: true,
        isVerified: true,
        rating: true,
        totalSales: true,
      },
    },
    _count: {
      select: {
        orders: true,
        reviews: true,
        returnRequests: true,
      },
    },
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { total, page, limit, users };
};

// Get profile by publicId
const getMyProfile = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    select: {
      id: true,
      publicId: true,
      email: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      lastLoginAt: true,
      createdAt: true,
      accountInfo: true,
      addresses: { where: { isDefault: true } },
      vendorProfile: true,
      couponsUsed: true,
      notifications: true,
      cart: true,
      orders: true,
      returnRequests: true,
      reviews: true,
      searchHistory: true,
      wallet: true,
      wishlist: true,
      orderStatusUpdates: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Get user by email or id

const getUserByIdOrEmail = async (identifier: string | number) => {
  const where =
    typeof identifier === "number" ? { id: identifier } : { email: identifier };
  const user = await prisma.user.findUnique({
    where,
    include: {
      accountInfo: true,
      addresses: true,
      vendorProfile: {
        include: {
          products: { take: 20, orderBy: { createdAt: "desc" } },
          withdrawRequests: { take: 20, orderBy: { createdAt: "desc" } },
        },
      },
      cart: {
        include: {
          items: {
            include: {
              product: { include: { images: true } },
              variant: true,
            },
          },
        },
      },
      wishlist: {
        include: {
          items: {
            include: { product: { include: { images: true } } },
          },
        },
      },
      orders: {
        include: {
          items: true,
          payment: true,
          shipment: true,
          returnRequests: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      reviews: {
        include: { product: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      couponsUsed: {
        include: { coupon: true },
        take: 20,
      },
      wallet: {
        include: { transactions: { take: 50, orderBy: { createdAt: "desc" } } },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      returnRequests: {
        include: { order: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: {
          orders: true,
          reviews: true,
          returnRequests: true,
          notifications: true,
        },
      },
    },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

// Make admin
const makeAdmin = async (publicId: string, email: string) => {
  const updater = await prisma.user.findUnique({
    where: { email, isActive: true },
  });
  // console.log(updater);
  if (!updater) {
    throw new AppError(httpStatus.NOT_FOUND, "Your account was not found");
  }

  const user = await prisma.user.findUnique({
    where: { publicId, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updated = await prisma.user.update({
    where: { publicId },
    data: { role: Role.ADMIN, roleUpdatedById: updater?.id ?? null },
    select: { publicId: true, email: true, role: true },
  });

  return updated;
};

// Update profile
const updateMyProfile = async (email: string, data: any) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { accountInfo: true },
  });
  // console.log(user);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  // if image uploaded via multer, req.body.avatar is already the cloudinary url
  const { firstName, lastName, displayName, bio, dateOfBirth, gender } = data;
  const avatar = data.profileImage;

  const updated = await prisma.accountInfo.update({
    where: { userId: user.id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(displayName && { displayName }),
      ...(bio && { bio }),
      ...(avatar && { avatar }),
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(gender && { gender }),
    },
  });

  return updated;
};

// toggle user status (inactive & banned) - admin only
const toggleUserStatus = async (id: number) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive: !user.isActive,
      isBanned: !user.isBanned,
    },
  });

  return updated;
};

// Soft delete
const deleteAProfile = async (publicId: string) => {
  const user = await prisma.user.findUnique({
    where: { publicId, isActive: true },
  });
  if (user?.role === Role.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot delete a SUPER_ADMIN account buggers!",
    );
  }

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  await prisma.user.update({
    where: { publicId },
    data: { isActive: false },
  });

  return { isDeleted: true };
};

// ─────────────────────────────────────────
// ADDRESS
// ─────────────────────────────────────────

// add address
const addAddress = async (
  email: string,
  payload: {
    type?: "HOME" | "OFFICE" | "BILLING" | "SHIPPING" | "OTHER";
    label?: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city_district: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // if this address is set as default
  // unset all existing defaults first
  if (payload.isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  // if this is the user's first address — make it default automatically
  const addressCount = await prisma.address.count({
    where: { userId: user.id },
  });

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      type: payload.type ?? "HOME",
      label: payload.label ?? null,
      fullName: payload.fullName,
      phone: payload.phone,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2 ?? null,
      city_district: payload.city_district,
      postalCode: payload.postalCode ?? null,
      country: payload.country ?? "BD",
      isDefault: payload.isDefault ?? addressCount === 0, // auto default if first
      landmark: payload.landmark ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
    },
  });

  return address;
};

// get all addresses for logged in user
const getMyAddresses = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [
      { isDefault: "desc" }, // default address always first
      { createdAt: "desc" },
    ],
  });

  return addresses;
};

// get single address
const getSingleAddress = async (email: string, addressId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId: user.id, // ensures user can only access their own
    },
  });

  if (!address) {
    throw new AppError(httpStatus.NOT_FOUND, "Address not found");
  }

  return address;
};

// update address
const updateAddress = async (
  email: string,
  addressId: number,
  payload: Partial<{
    type: "HOME" | "OFFICE" | "BILLING" | "SHIPPING" | "OTHER";
    label: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city_district: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
    landmark: string;
    latitude: number;
    longitude: number;
  }>,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });

  if (!address) {
    throw new AppError(httpStatus.NOT_FOUND, "Address not found");
  }

  // if setting this as default — unset others first
  if (payload.isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.address.update({
    where: { id: addressId },
    data: payload,
  });

  return updated;
};

// set default address
const setDefaultAddress = async (email: string, addressId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });

  if (!address) {
    throw new AppError(httpStatus.NOT_FOUND, "Address not found");
  }

  // transaction — unset all then set the target
  await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
    await tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

  return "Default address updated";
};

// delete address
const deleteAddress = async (email: string, addressId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });

  if (!address) {
    throw new AppError(httpStatus.NOT_FOUND, "Address not found");
  }

  // block deletion if it's the only address
  const addressCount = await prisma.address.count({
    where: { userId: user.id },
  });

  if (addressCount === 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You must have at least one address. Update it instead.",
    );
  }

  await prisma.address.delete({ where: { id: addressId } });

  // if deleted address was default — auto promote newest remaining
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return "Address deleted successfully";
};

export const userService = {
  registerUser,
  getAllUsers,
  getMyProfile,
  getUserByIdOrEmail,
  makeAdmin,
  updateMyProfile,
  toggleUserStatus,
  deleteAProfile,
  // address
  addAddress,
  getMyAddresses,
  getSingleAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
