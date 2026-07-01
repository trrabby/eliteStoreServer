import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// recalculate and update product averageRating + reviewCount
const syncProductRating = async (productId: number, tx?: any) => {
  const client = tx ?? prisma;

  const stats = await client.review.aggregate({
    where: {
      productId,
      status: "APPROVED",
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await client.product.update({
    where: { id: productId },
    data: {
      averageRating: stats._avg.rating ?? 0,
      reviewCount: stats._count.rating ?? 0,
    },
  });
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// create review — only verified purchasers
const createReview = async (
  email: string,
  payload: {
    productId: number;
    orderItemId: number;
    rating: number;
    title?: string;
    body?: string;
  },
  images?: string[],
) => {
  // 1. Validate user
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // 2. Verify order item belongs to user and is delivered
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      id: payload.orderItemId,
      order: {
        userId: user.id,
        status: "DELIVERED",
      },
    },
    select: { id: true, productId: true },
  });

  if (!orderItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only review products from delivered orders",
    );
  }

  if (orderItem.productId !== payload.productId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Product does not match the order item",
    );
  }

  // 3. Check if already reviewed
  const existing = await prisma.review.findFirst({
    where: {
      productId: payload.productId,
      userId: user.id,
      orderItemId: payload.orderItemId,
    },
  });

  if (existing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already reviewed this product for this order",
    );
  }

  // 4. Get product and vendor info (needed for vendor rating)
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: {
      vendorId: true,
      vendor: {
        select: {
          id: true,
          rating: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  // 5. Execute all writes in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // 5a. Create the review
    const created = await tx.review.create({
      data: {
        productId: payload.productId,
        userId: user.id,
        orderItemId: payload.orderItemId,
        rating: payload.rating,
        title: payload.title ?? null,
        body: payload.body ?? null,
        images: images ?? [],
        status: "APPROVED", // auto-approve — add manual moderation if needed
        isVerified: true, // verified purchase
      },
    });

    // 5b. Sync product average rating
    await syncProductRating(payload.productId, tx);

    // 5c. Update vendor rating if vendor exists
    if (product.vendor) {
      // Get current count of approved reviews for this vendor
      const vendorReviewCount = await tx.review.count({
        where: {
          product: {
            vendorId: product.vendorId,
          },
          status: "APPROVED",
        },
      });

      // Get current vendor rating (from product.vendor.rating)
      const currentVendorRating = Number(product.vendor.rating ?? 0);

      // Compute new rating: (old_avg * old_count + new_rating) / (old_count + 1)
      const newVendorRating =
        vendorReviewCount === 0
          ? payload.rating
          : (currentVendorRating * vendorReviewCount + payload.rating) /
            (vendorReviewCount + 1);

      // Round to 2 decimal places
      const roundedRating = Math.round(newVendorRating * 100) / 100;

      // Update vendor profile rating
      await tx.vendorProfile.update({
        where: { id: product.vendor.id },
        data: { rating: roundedRating },
      });
    }

    return created;
  });

  return result;
};

// get reviews for a product — public
const getProductReviews = async (
  productId: number,
  query: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: string; // "newest" | "oldest" | "highest" | "lowest" | "helpful"
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: any = {
    productId,
    status: "APPROVED",
  };

  if (query.rating) where.rating = query.rating;

  let orderBy: any = { createdAt: "desc" };

  if (query.sortBy === "oldest") orderBy = { createdAt: "asc" };
  if (query.sortBy === "highest") orderBy = { rating: "desc" };
  if (query.sortBy === "lowest") orderBy = { rating: "asc" };
  if (query.sortBy === "helpful") orderBy = { helpfulCount: "desc" };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        publicId: true,
        rating: true,
        title: true,
        body: true,
        images: true,
        isVerified: true,
        helpfulCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            accountInfo: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        votes: {
          select: {
            userId: true,
            isHelpful: true,
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  // rating breakdown
  const breakdown = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, status: "APPROVED" },
    _count: { rating: true },
  });

  const ratingBreakdown: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const b of breakdown) {
    ratingBreakdown[b.rating] = b._count.rating;
  }

  return {
    total,
    page,
    limit,
    ratingBreakdown,
    reviews,
  };
};

// get all reviews — admin
const getAllReviews = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  productId?: number;
  rating?: number;
  search?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.productId) where.productId = query.productId;
  if (query.rating) where.rating = query.rating;

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { body: { contains: query.search, mode: "insensitive" } },
      {
        user: {
          email: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, name: true, slug: true },
        },
        user: {
          select: {
            email: true,
            accountInfo: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { total, page, limit, reviews };
};

// get all reviews of a vendor - vendor
const getAllReviewsByVendor = async (
  vendorId: number,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: number;
    rating?: number;
    search?: string;
    sortBy?: string;
    dateFrom?: string;
    dateTo?: string;
    hasResponse?: boolean;
    withImages?: boolean;
  },
) => {
  // console.log(vendorId, query);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt_desc";

  // Build where clause - filter by product's vendorId
  const where: any = {
    product: {
      vendorId: vendorId,
    },
  };

  // Basic filters
  if (query.status) where.status = query.status;
  if (query.productId) where.productId = query.productId;
  if (query.rating) where.rating = query.rating;

  // Filter by date range
  if (query.dateFrom) {
    where.createdAt = {
      ...where.createdAt,
      gte: new Date(query.dateFrom),
    };
  }
  if (query.dateTo) {
    where.createdAt = {
      ...where.createdAt,
      lte: new Date(query.dateTo),
    };
  }

  // Filter by response status (if you have vendorResponse in your schema)
  // Note: Based on your schema, there's no vendorResponse field in Review model
  // You might need to add this or remove this filter
  if (query.hasResponse !== undefined) {
    // If you have a vendorResponse relation, use it
    // where.vendorResponse = query.hasResponse ? { isNot: null } : null;
    // For now, we'll skip this filter or you can implement it if you have the relation
  }

  // Filter by images - using the images array in Review model
  if (query.withImages !== undefined) {
    if (query.withImages) {
      where.images = { isEmpty: false };
    } else {
      where.images = { isEmpty: true };
    }
  }

  // Search functionality
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { body: { contains: query.search, mode: "insensitive" } },
      {
        product: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        user: {
          email: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        user: {
          accountInfo: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  // Build order by
  let orderBy: any = {};
  switch (sortBy) {
    case "createdAt_desc":
      orderBy = { createdAt: "desc" };
      break;
    case "createdAt_asc":
      orderBy = { createdAt: "asc" };
      break;
    case "rating_desc":
      orderBy = { rating: "desc" };
      break;
    case "rating_asc":
      orderBy = { rating: "asc" };
      break;
    case "updatedAt_desc":
      orderBy = { updatedAt: "desc" };
      break;
    case "updatedAt_asc":
      orderBy = { updatedAt: "asc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            vendorId: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
            vendor: {
              select: {
                id: true,
                storeName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            accountInfo: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        statusUpdatedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  // Calculate summary statistics (only for reviews belonging to this vendor)
  const summary = await prisma.review.aggregate({
    where,
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
    _min: {
      rating: true,
    },
    _max: {
      rating: true,
    },
  });

  // Calculate rating distribution
  const ratingDistribution = await prisma.review.groupBy({
    by: ["rating"],
    where,
    _count: {
      rating: true,
    },
  });

  // Transform rating distribution
  const distribution = [1, 2, 3, 4, 5].map((rating) => {
    const found = ratingDistribution.find((r) => r.rating === rating);
    return {
      rating,
      count: found?._count.rating || 0,
    };
  });

  // Transform reviews to include image URLs properly
  const transformedReviews = reviews.map((review) => ({
    ...review,
    images: review.images || [], // images is already an array of strings
  }));

  return {
    success: true,
    data: {
      reviews: transformedReviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        averageRating: summary._avg.rating || 0,
        totalReviews: summary._count.id,
        minRating: summary._min.rating || 0,
        maxRating: summary._max.rating || 0,
      },
      distribution,
    },
  };
};

// get my reviews — customer
const getMyReviews = async (
  email: string,
  query: { page?: number; limit?: number },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { userId: user.id },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    }),
    prisma.review.count({ where: { userId: user.id } }),
  ]);

  return { total, page, limit, reviews };
};

// get single review
const getReviewById = async (id: number) => {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      product: {
        select: { id: true, name: true, slug: true },
      },
      user: {
        select: {
          email: true,
          accountInfo: {
            select: { firstName: true, lastName: true, avatar: true },
          },
        },
      },
      votes: true,
    },
  });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  return review;
};

// update review — owner only
const updateReview = async (
  id: number,
  email: string,
  payload: {
    rating?: number;
    title?: string;
    body?: string;
    prevImg?: string[];
  },
  images?: string[],
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const review = await prisma.review.findFirst({
    where: { id, userId: user.id },
  });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { prevImg, ...restPayload } = payload;
    const mergedImages = [...(images || []), ...(prevImg || [])];

    const updatedReview = await tx.review.update({
      where: { id },
      data: {
        ...restPayload,
        images: mergedImages,
        // reset to approved after edit
        status: "APPROVED",
      },
    });

    // sync rating if changed
    if (payload.rating) {
      await syncProductRating(review.productId, tx);
    }

    return updatedReview;
  });

  return updated;
};

// delete review — owner or admin
const deleteReview = async (id: number, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const review = await prisma.review.findFirst({
    where: {
      id,
      ...(!isAdmin && { userId: user.id }),
    },
  });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    await syncProductRating(review.productId, tx);
  });

  return "Review deleted successfully";
};

// moderate review — admin
const moderateReview = async (
  id: number,
  email: string,
  payload: { status: string; note?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const review = await prisma.review.findUnique({ where: { id } });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReview = await tx.review.update({
      where: { id },
      data: { status: payload.status as any, statusUpdatedById: user.id },
    });

    // sync rating whenever status changes
    await syncProductRating(review.productId, tx);

    return updatedReview;
  });

  return updated;
};

// vote on review — helpful or not
const voteReview = async (
  reviewId: number,
  email: string,
  isHelpful: boolean,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // cannot vote on own review
  if (review.userId === user.id) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot vote on your own review",
    );
  }

  // check existing vote
  const existingVote = await prisma.reviewVote.findUnique({
    where: {
      userId_reviewId: { userId: user.id, reviewId },
    },
  });

  await prisma.$transaction(async (tx) => {
    if (existingVote) {
      if (existingVote.isHelpful === isHelpful) {
        // same vote — remove it (toggle off)
        await tx.reviewVote.delete({
          where: {
            userId_reviewId: { userId: user.id, reviewId },
          },
        });

        // decrement only if was helpful
        if (isHelpful) {
          await tx.review.update({
            where: { id: reviewId },
            data: { helpfulCount: { decrement: 1 } },
          });
        }
      } else {
        // changed vote
        await tx.reviewVote.update({
          where: {
            userId_reviewId: { userId: user.id, reviewId },
          },
          data: { isHelpful },
        });

        // adjust helpfulCount
        await tx.review.update({
          where: { id: reviewId },
          data: {
            helpfulCount: isHelpful ? { increment: 1 } : { decrement: 1 },
          },
        });
      }
    } else {
      // new vote
      await tx.reviewVote.create({
        data: { userId: user.id, reviewId, isHelpful },
      });

      if (isHelpful) {
        await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { increment: 1 } },
        });
      }
    }
  });

  return "Vote recorded";
};

// get review stats — admin dashboard
const getReviewStats = async () => {
  const [total, pending, approved, rejected, flagged, verified] =
    await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { status: "APPROVED" } }),
      prisma.review.count({ where: { status: "REJECTED" } }),
      prisma.review.count({ where: { status: "FLAGGED" } }),
      prisma.review.count({ where: { isVerified: true } }),
    ]);

  const avgRating = await prisma.review.aggregate({
    where: { status: "APPROVED" },
    _avg: { rating: true },
  });

  return {
    total,
    pending,
    approved,
    rejected,
    flagged,
    verified,
    averageRating: avgRating._avg.rating ?? 0,
  };
};

export const reviewService = {
  createReview,
  getProductReviews,
  getAllReviews,
  getAllReviewsByVendor,
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
  moderateReview,
  voteReview,
  getReviewStats,
};
