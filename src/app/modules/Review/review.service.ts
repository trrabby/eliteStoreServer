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
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // verify order item belongs to user and is delivered
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      id: payload.orderItemId,
      order: {
        userId: user.id,
        status: "DELIVERED",
      },
    },
    include: { order: true },
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

  // check already reviewed
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

  const review = await prisma.$transaction(async (tx) => {
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

    // sync product rating
    await syncProductRating(payload.productId, tx);

    return created;
  });

  return review;
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
    const updatedReview = await tx.review.update({
      where: { id },
      data: {
        ...payload,
        ...(images?.length && { images }),
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
  payload: { status: string; note?: string },
) => {
  const review = await prisma.review.findUnique({ where: { id } });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReview = await tx.review.update({
      where: { id },
      data: { status: payload.status as any },
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
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
  moderateReview,
  voteReview,
  getReviewStats,
};
