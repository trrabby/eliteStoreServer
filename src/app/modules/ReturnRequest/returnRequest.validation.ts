import { z } from "zod";

const createReturnRequest = z.object({
  body: z.object({
    orderId: z.number().int().positive("Order ID is required"),
    reason: z.enum([
      "DAMAGED",
      "WRONG_ITEM",
      "NOT_AS_DESCRIBED",
      "CHANGED_MIND",
      "OTHER",
    ]),
    description: z
      .string()
      .min(10, "Please describe the issue in detail")
      .optional(),
    // which specific order items to return — if empty means full order return
    items: z
      .array(
        z.object({
          orderItemId: z.number().int().positive(),
          quantity: z.number().int().positive("Quantity must be at least 1"),
        }),
      )
      .min(1, "At least one item is required for return"),
  }),
});

const processReturn = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    refundAmount: z.number().positive().optional(),
    // where refund goes
    refundTo: z.enum(["WALLET", "ORIGINAL_METHOD"]).default("WALLET"),
    note: z.string().optional(),
  }),
});

const updateReturnStatus = z.object({
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED"]),
    note: z.string().optional(),
  }),
});

export const returnRequestValidation = {
  createReturnRequest,
  processReturn,
  updateReturnStatus,
};
