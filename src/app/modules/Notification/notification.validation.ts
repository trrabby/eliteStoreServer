import { z } from "zod";

const savePushSubscription = z.object({
  body: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

const createNotification = z.object({
  body: z.object({
    userId: z.number().int().positive(),
    type: z.enum([
      "ORDER_UPDATE",
      "PAYMENT",
      "PROMOTION",
      "REVIEW",
      "SYSTEM",
      "RESTOCK",
    ]),
    title: z.string().min(1),
    body: z.string().min(1),
    link: z.string().optional(),
  }),
});

export const notificationValidation = {
  savePushSubscription,
  createNotification,
};
