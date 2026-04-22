import { z } from "zod";

const createOrder = z.object({
  body: z.object({
    shippingAddressId: z
      .number()
      .int()
      .positive("Shipping address is required"),
    billingAddressId: z.number().int().positive().optional(),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const cancelOrder = z.object({
  body: z.object({
    cancelReason: z.string().min(1, "Cancel reason is required"),
  }),
});

const updateOrderStatus = z.object({
  body: z.object({
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURN_REQUESTED",
      "RETURNED",
      "REFUNDED",
    ]),
    note: z.string().optional(),
  }),
});

const updateOrderStatusBulk = z.object({
  body: z.object({
    orderIds: z.array(z.number()).min(1),
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURN_REQUESTED",
      "RETURNED",
      "REFUNDED",
    ]),
    note: z.string().optional(),
    isPaymentReceived: z.boolean().optional(),
  }),
});

export const orderValidation = {
  createOrder,
  cancelOrder,
  updateOrderStatus,
  updateOrderStatusBulk,
};
