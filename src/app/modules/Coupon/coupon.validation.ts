import { z } from "zod";

const createCoupon = z.object({
  body: z.object({
    code:           z.string().min(3, "Code must be at least 3 characters").toUpperCase(),
    description:    z.string().optional(),
    discountType:   z.enum(["PERCENTAGE", "FLAT"]),
    discountValue:  z.number().positive("Discount value must be positive"),
    minOrderAmount: z.number().positive().optional(),
    maxDiscount:    z.number().positive().optional(),
    usageLimit:     z.number().int().positive().optional(),
    perUserLimit:   z.number().int().positive().default(1),
    isActive:       z.boolean().default(true),
    startsAt:       z.string().datetime("Invalid start date"),
    expiresAt:      z.string().datetime("Invalid expiry date"),
  }).refine(
    (data) => new Date(data.expiresAt) > new Date(data.startsAt),
    {
      message: "Expiry date must be after start date",
      path:    ["expiresAt"],
    }
  ).refine(
    (data) =>
      data.discountType === "PERCENTAGE"
        ? data.discountValue <= 100
        : true,
    {
      message: "Percentage discount cannot exceed 100%",
      path:    ["discountValue"],
    }
  ),
});

const updateCoupon = z.object({
  body: z.object({
    description:    z.string().optional(),
    discountType:   z.enum(["PERCENTAGE", "FLAT"]).optional(),
    discountValue:  z.number().positive().optional(),
    minOrderAmount: z.number().positive().nullable().optional(),
    maxDiscount:    z.number().positive().nullable().optional(),
    usageLimit:     z.number().int().positive().nullable().optional(),
    perUserLimit:   z.number().int().positive().optional(),
    isActive:       z.boolean().optional(),
    startsAt:       z.string().datetime().optional(),
    expiresAt:      z.string().datetime().optional(),
  }),
});

const applyCoupon = z.object({
  body: z.object({
    code:        z.string().min(1, "Coupon code is required"),
    orderAmount: z.number().positive("Order amount is required"),
  }),
});

export const couponValidation = {
  createCoupon,
  updateCoupon,
  applyCoupon,
};