import { z } from "zod";

const initiatePayment = z.object({
  body: z.object({
    orderId: z.number().int().positive("Order ID is required"),
    method: z.enum([
      "CREDIT_CARD",
      "DEBIT_CARD",
      "NET_BANKING",
      "MOBILE_BANKING",
      "CASH_ON_DELIVERY",
    ]),
    // for bKash / Nagad — customer provides their mobile number
    mobileNumber: z.string().optional(),
  }),
});

const verifyPayment = z.object({
  body: z.object({
    orderId: z.number().int().positive(),
    transactionId: z.string().min(1),
  }),
});

export const paymentValidation = {
  initiatePayment,
  verifyPayment,
};
