import httpStatus from "http-status";
import slugify from "slugify";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { Role } from "@prisma/client";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// generate unique slug from storeName
const generateSlug = async (storeName: string): Promise<string> => {
  const base = slugify(storeName, { lower: true, strict: true });
  let slug = base;
  let count = 1;

  while (true) {
    const exists = await prisma.vendorProfile.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${count}`;
    count++;
  }

  return slug;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create vendor profile — any logged in user can become a vendor
const createVendorProfile = async (
  email: string,
  payload: {
    storeName: string;
    description?: string;
    returnPolicy?: string;
    supportEmail?: string;
    supportPhone?: string;
  },
  logo?: string,
  banner?: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.vendorProfile) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You already have a vendor profile",
    );
  }

  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Admins cannot create vendor profiles. Please use a regular account to create a vendor profile.",
    );
  }

  // check storeName uniqueness
  const storeExists = await prisma.vendorProfile.findUnique({
    where: { storeName: payload.storeName },
  });

  if (storeExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Store name is already taken. Please choose another.",
    );
  }

  const slug = await generateSlug(payload.storeName);

  const vendorProfile = await prisma.$transaction(async (tx) => {
    const profile = await tx.vendorProfile.create({
      data: {
        userId: user.id,
        storeName: payload.storeName,
        slug,
        description: payload.description ?? null,
        returnPolicy: payload.returnPolicy ?? null,
        supportEmail: payload.supportEmail ?? null,
        supportPhone: payload.supportPhone ?? null,
        logo: logo ?? null,
        banner: banner ?? null,
      },
    });

    // upgrade user role to VENDOR
    await tx.user.update({
      where: { id: user.id },
      data: { role: Role.VENDOR },
    });

    return profile;
  });

  return vendorProfile;
};

// get all vendor profiles — public, paginated
const getAllVendors = async (query: {
  page?: number;
  limit?: number;
  isVerified?: boolean;
  search?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: any = { isActive: true };

  if (query.isVerified !== undefined) {
    where.isVerified = query.isVerified;
  }

  if (query.search) {
    where.OR = [
      { storeName: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    prisma.vendorProfile.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        publicId: true,
        storeName: true,
        slug: true,
        logo: true,
        banner: true,
        description: true,
        rating: true,
        totalSales: true,
        isVerified: true,
        createdAt: true,
        user: {
          select: {
            accountInfo: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vendorProfile.count({ where }),
  ]);

  return { total, page, limit, vendors };
};

// get vendor by slug — public
const getVendorBySlug = async (slug: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { slug, isActive: true },
    include: {
      user: {
        select: {
          accountInfo: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      },
      products: {
        where: { status: "ACTIVE" },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          publicId: true,
          name: true,
          slug: true,
          averageRating: true,
          reviewCount: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
          },
          variants: {
            where: { isDefault: true },
            take: 1,
            select: { price: true, comparePrice: true },
          },
        },
      },
    },
  });

  if (!vendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  return vendor;
};

// get my vendor profile — logged in vendor
const getMyVendorProfile = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: {
      vendorProfile: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.vendorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  return user.vendorProfile;
};

// update vendor profile — vendor themselves only
const updateVendorProfile = async (
  email: string,
  payload: {
    storeName?: string;
    description?: string;
    returnPolicy?: string;
    supportEmail?: string;
    supportPhone?: string;
    logo?: string;
    banner?: string;
  },
  logo?: string,
  banner?: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.vendorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  // if storeName is being changed — check uniqueness + regenerate slug
  let slug: string | undefined;

  if (payload.storeName && payload.storeName !== user.vendorProfile.storeName) {
    const storeExists = await prisma.vendorProfile.findUnique({
      where: { storeName: payload.storeName },
    });

    if (storeExists) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Store name is already taken.",
      );
    }

    slug = await generateSlug(payload.storeName);
  }

  const updated = await prisma.vendorProfile.update({
    where: { userId: user.id },
    data: {
      ...payload,
      logo: logo ?? payload.logo,
      banner: banner ?? payload.banner,
      ...(slug && { slug }),
    },
  });

  return updated;
};

// verify vendor — admin only
const verifyVendor = async (publicId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { publicId },
  });

  if (!vendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  if (vendor.isVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "Vendor is already verified");
  }

  const updated = await prisma.vendorProfile.update({
    where: { publicId },
    data: { isVerified: true },
    select: {
      publicId: true,
      storeName: true,
      isVerified: true,
    },
  });

  return updated;
};

// deactivate vendor — admin only
const deactivateVendor = async (publicId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { publicId },
  });

  if (!vendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  const updated = await prisma.vendorProfile.update({
    where: { publicId },
    data: { isActive: false },
    select: {
      publicId: true,
      storeName: true,
      isActive: true,
    },
  });

  return updated;
};

// delete vendor profile — vendor themselves only
const deleteVendorProfile = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.vendorProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor profile not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorProfile.delete({
      where: { userId: user.id },
    });

    // downgrade role back to CUSTOMER
    await tx.user.update({
      where: { id: user.id },
      data: { role: Role.CUSTOMER },
    });
  });

  return "Vendor profile deleted successfully";
};

export const vendorProfileService = {
  createVendorProfile,
  getAllVendors,
  getVendorBySlug,
  getMyVendorProfile,
  updateVendorProfile,
  verifyVendor,
  deactivateVendor,
  deleteVendorProfile,
};
