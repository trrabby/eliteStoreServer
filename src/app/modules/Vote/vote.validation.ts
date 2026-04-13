import { z } from "zod";

const createVote = z.object({
  reviewId: z.string().uuid({ message: "Invalid review ID format" }),
  accountId: z.string().uuid({ message: "Invalid account ID format" }),
  upVote: z
    .number()
    .int()
    .nonnegative({ message: "Upvote must be a non-negative integer" }),
  downVote: z
    .number()
    .int()
    .nonnegative({ message: "Downvote must be a non-negative integer" }),
});

const updateVote = z.object({
  upVote: z.number().int().nonnegative().optional(),
  downVote: z.number().int().nonnegative().optional(),
});

export const voteValidation = {
  createVote,
  updateVote,
};
