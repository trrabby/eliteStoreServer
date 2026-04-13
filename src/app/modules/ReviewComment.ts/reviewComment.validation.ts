import { z } from "zod";

const createReviewComment = z.object({
  reviewId: z.string().uuid({ message: "Invalid review ID format" }),
  accountId: z.string().uuid({ message: "Invalid account ID format" }),
  content: z.string().min(1, { message: "Comment content is required" }),
});

const updateReviewComment = z.object({
  content: z.string().min(1, { message: "Comment content is required" }).optional(),
  isDeleted: z.boolean().optional(),
});

export const ReviewCommentValidation = {
  createReviewComment,
  updateReviewComment,
};
