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

const createBulkNotification = z.object({
  body: z
    .object({
      userIds: z.array(z.number().int().positive()).optional(),
      type: z.enum([
        "ORDER_UPDATE",
        "PAYMENT",
        "PROMOTION",
        "REVIEW",
        "SYSTEM",
        "RESTOCK",
      ]),
      title: z.string().min(1, "Title is required"),
      body: z.string().min(1, "Body is required"),
      link: z.string().optional(),
    })
    .refine(
      (data) => {
        // If userIds is provided, it must not be empty
        if (data.userIds !== undefined && data.userIds.length === 0) {
          return false;
        }
        return true;
      },
      {
        message: "If userIds is provided, it must contain at least one user ID",
        path: ["userIds"],
      },
    ),
});

export const notificationValidation = {
  savePushSubscription,
  createBulkNotification,
};
