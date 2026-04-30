import { Request } from "express";
import bcrypt from "bcrypt";
import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { Role } from "@prisma/client";

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

// Get all users — admin only
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
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
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const count = await prisma.user.count({ where: { isActive: true } });

  return { count, users };
};

// Get profile by publicId
const getMyProfile = async (publicId: string) => {
  const user = await prisma.user.findUnique({
    where: { publicId, isActive: true },
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
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Get user by email
const getAccountByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    select: {
      id: true,
      publicId: true,
      email: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      isBanned: true,
      createdAt: true,
      accountInfo: true,
      orders: {
        select: {
          id: true,
          publicId: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          title: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Make admin
const makeAdmin = async (publicId: string) => {
  const user = await prisma.user.findUnique({
    where: { publicId, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const updated = await prisma.user.update({
    where: { publicId },
    data: { role: Role.ADMIN },
    select: { publicId: true, email: true, role: true },
  });

  return updated;
};

// Update profile
const updateMyProfile = async (email: string, req: Request) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { accountInfo: true },
  });
  // console.log(user);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const data = JSON.parse(req.body.data);
  // console.log(data);
  // if image uploaded via multer, req.body.avatar is already the cloudinary url
  const { firstName, lastName, displayName, bio, dateOfBirth, gender } = data;
  const avatar = req.file?.path;

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
      "You must have at least one address. Update it instead of deleting.",
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
  getAccountByEmail,
  makeAdmin,
  updateMyProfile,
  deleteAProfile,
  // address
  addAddress,
  getMyAddresses,
  getSingleAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
