import { z } from "zod";

const createWithdrawRequest = z.object({
  body: z.object({
    amount: z.number().positive("Withdraw amount must be positive"),
    paymentMethod: z.string().min(2, "Payment method is required"),
    description: z.string().optional(),
  }),
});

const updateWithdrawStatus = z.object({
  body: z.object({
    status: z.enum(["PROCESSING", "PAID", "CANCELLED"]),
    paidThrough: z.string().optional(),
    cancelReason: z.string().optional(),
    processingDetails: z.string().optional(),
    paidOn: z.string().optional(),
  }),
});

const cancelWithdrawRequest = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const vendorWithdrawValidation = {
  createWithdrawRequest,
  updateWithdrawStatus,
  cancelWithdrawRequest,
};
