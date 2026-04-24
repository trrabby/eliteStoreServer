import { z } from "zod";

const addMoney = z.object({
  body: z.object({
    amount: z.number().positive().min(10, "Minimum top-up is 10 BDT"),
    method: z.enum(["SSLCOMMERZ", "BKASH"]),
    mobileNumber: z.string().optional(), // bKash number
  }),
});

const transferToWallet = z.object({
  body: z.object({
    recipientEmail: z.string().email("Invalid email"),
    amount: z.number().positive().min(1, "Amount must be positive"),
    note: z.string().optional(),
  }),
});

const withdrawRequest = z.object({
  body: z.object({
    amount: z.number().positive().min(100, "Minimum withdrawal is 100 BDT"),
    method: z.enum(["BKASH", "BANK"]),
    accountInfo: z.string().min(1, "Account info is required"),
    note: z.string().optional(),
  }),
});

export const walletValidation = {
  addMoney,
  transferToWallet,
  withdrawRequest,
};
