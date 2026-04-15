import httpStatus from "http-status";
import slugify from "slugify";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

const generateSlug = async (name: string): Promise<string> => {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let count = 1;

  while (true) {
    const exists = await prisma.brand.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${count}`;
    count++;
  }

  return slug;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create brand — admin only
const createBrand = async (
  payload: {
    name: string;
    description?: string;
    website?: string;
    country?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  },
  logo?: string,
  banner?: string,
) => {
  // check name uniqueness
  const brandExists = await prisma.brand.findUnique({
    where: { name: payload.name },
  });

  if (brandExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Brand name already exists. Please choose another.",
    );
  }

  const slug = await generateSlug(payload.name);

  const brand = await prisma.brand.create({
    data: {
      name: payload.name,
      slug,
      description: payload.description ?? null,
      website: payload.website ?? null,
      country: payload.country ?? null,
      isFeatured: payload.isFeatured ?? false,
      isActive: payload.isActive ?? true,
      logo: logo ?? null,
      banner: banner ?? null,
    },
  });

  return brand;
};

// get all brands — public, paginated
const getAllBrands = async (query: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  search?: string;
  country?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
  if (query.country)
    where.country = { equals: query.country, mode: "insensitive" };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        banner: true,
        description: true,
        website: true,
        country: true,
        isActive: true,
        isFeatured: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    }),
    prisma.brand.count({ where }),
  ]);

  return { total, page, limit, brands };
};

// get featured brands — public
const getFeaturedBrands = async () => {
  const brands = await prisma.brand.findMany({
    where: { isActive: true, isFeatured: true },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      country: true,
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return brands;
};

// get brand by slug — public
const getBrandBySlug = async (slug: string) => {
  const brand = await prisma.brand.findUnique({
    where: { slug, isActive: true },
    include: {
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
      _count: {
        select: { products: true },
      },
    },
  });

  if (!brand) {
    throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
  }

  return brand;
};

// get brand by id — admin
const getBrandById = async (id: number) => {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!brand) {
    throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
  }

  return brand;
};

// update brand — admin only
const updateBrand = async (
  id: number,
  payload: {
    name?: string;
    description?: string;
    website?: string;
    country?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  },
  logo?: string,
  banner?: string,
) => {
  const brand = await prisma.brand.findUnique({ where: { id } });

  if (!brand) {
    throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
  }

  // check name uniqueness if name is being changed
  let slug: string | undefined;

  if (payload.name && payload.name !== brand.name) {
    const nameExists = await prisma.brand.findUnique({
      where: { name: payload.name },
    });

    if (nameExists) {
      throw new AppError(httpStatus.BAD_REQUEST, "Brand name already exists.");
    }

    slug = await generateSlug(payload.name);
  }

  const updated = await prisma.brand.update({
    where: { id },
    data: {
      ...payload,
      logo: logo ?? brand.logo,
      banner: banner ?? brand.banner,
      ...(slug && { slug }),
    },
  });

  return updated;
};

// toggle featured — admin only
const toggleFeatured = async (id: number) => {
  const brand = await prisma.brand.findUnique({ where: { id } });

  if (!brand) {
    throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
  }

  const updated = await prisma.brand.update({
    where: { id },
    data: { isFeatured: !brand.isFeatured },
    select: {
      id: true,
      name: true,
      isFeatured: true,
    },
  });

  return updated;
};

// delete brand — admin only
const deleteBrand = async (id: number) => {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!brand) {
    throw new AppError(httpStatus.NOT_FOUND, "Brand not found");
  }

  // block if products are assigned
  if (brand._count.products > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete — this brand has ${brand._count.products} products assigned. Reassign them first.`,
    );
  }

  const result = await prisma.brand.delete({ where: { id } });

  return result;
};

export const brandService = {
  createBrand,
  getAllBrands,
  getFeaturedBrands,
  getBrandBySlug,
  getBrandById,
  updateBrand,
  toggleFeatured,
  deleteBrand,
};
