import { ReviewStatus } from "@prisma/client";
import { z } from "zod";

// Enum for review status
const ReviewStatusEnum = z.enum([
  ReviewStatus.APPROVED,
  ReviewStatus.PENDING,
  ReviewStatus.REJECTED,
]);

const baseReviewFields = {
  title: z.string().min(3, "Title must be at least 3 characters"),
  rating: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .refine((val) => val >= 1 && val <= 5, {
      message: "Rating must be between 1 and 5",
    }),

  productId: z
    .union([z.string().uuid(), z.literal(null)])
    .optional()
    .nullable(),

  purchaseSource: z.string().optional().nullable(),

  images: z
    .union([
      z.array(z.string().url()),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }),
    ])
    .optional()
    .default([]),

  isPremium: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional()
    .default(false),

  premiumPrice: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .optional()
    .default(5.0),

  previewContent: z.string().optional().nullable(),
  fullContent: z.string().optional().nullable(),

  accountId: z.string().uuid(),

  status: ReviewStatusEnum.optional().default(ReviewStatus.PENDING),
  moderationNote: z.string().optional().nullable(),

  isDeleted: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional()
    .default(false),
};

const createReviewSchema = z.object({
  ...baseReviewFields,
});

const updateReviewSchema = z.object({
  title: z.string().min(3).optional(),
  rating: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .refine((val) => val >= 1 && val <= 5)
    .optional(),

  productId: z.string().uuid().nullable().optional(),
  purchaseSource: z.string().optional().nullable(),

  images: z
    .union([
      z.array(z.string().url()),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }),
    ])
    .optional(),

  isPremium: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),

  premiumPrice: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .optional(),

  previewContent: z.string().optional().nullable(),
  fullContent: z.string().optional().nullable(),

  status: ReviewStatusEnum.optional(),
  moderationNote: z.string().optional().nullable(),

  isDeleted: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
});

export const reviewValidation = {
  createReviewSchema,
  updateReviewSchema,
};
