import { z } from "zod";

const createShipment = z.object({
  body: z.object({
    orderId: z.number().int().positive("Order ID is required"),
    carrier: z.string().min(1, "Carrier is required"),
    trackingNumber: z.string().min(1, "Tracking number is required"),
    trackingUrl: z.string().url("Invalid tracking URL").optional(),
    estimatedAt: z.string().datetime("Invalid estimated date").optional(),
  }),
});

const updateShipment = z.object({
  body: z.object({
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().url().optional(),
    estimatedAt: z.string().datetime().optional(),
  }),
});

const markOutForDelivery = z.object({
  body: z.object({
    shipmentIds: z
      .array(z.number().int().positive())
      .min(1, "At least one shipment ID is required"),
  }),
});

const markDelivered = z.object({
  body: z.object({
    shipmentIds: z
      .array(z.number().int().positive())
      .min(1, "At least one shipment ID is required"),
    deliveredAt: z.string().datetime().optional(),
  }),
});

// steadfast bulk create
const steadfastBulkCreate = z.object({
  body: z.object({
    orderIds: z
      .array(z.number().int().positive())
      .min(1, "At least one order ID is required"),
  }),
});

// steadfast sync statuses
const steadfastSyncStatus = z.object({
  body: z.object({
    shipmentIds: z
      .array(z.number().int().positive())
      .min(1, "At least one shipment ID is required"),
  }),
});

export const shipmentValidation = {
  createShipment,
  updateShipment,
  markOutForDelivery,
  markDelivered,
  steadfastBulkCreate,
  steadfastSyncStatus,
};
