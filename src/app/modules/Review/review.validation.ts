import { z } from "zod";

const createReview = z.object({
  body: z.object({
    productId: z.number().int().positive("Product ID is required"),
    orderItemId: z.number().int().positive("Order item ID is required"),
    rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
    title: z.string().max(100).optional(),
    body: z
      .string()
      .min(10, "Review must be at least 10 characters")
      .optional(),
  }),
});

const updateReview = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(100).optional(),
    body: z.string().min(10).optional(),
  }),
});

const voteReview = z.object({
  body: z.object({
    isHelpful: z.boolean(),
  }),
});

const moderateReview = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED", "FLAGGED"]),
    note: z.string().optional(),
  }),
});

export const reviewValidation = {
  createReview,
  updateReview,
  voteReview,
  moderateReview,
};
