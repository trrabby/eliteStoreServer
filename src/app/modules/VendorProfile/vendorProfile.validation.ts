import { z } from "zod";

const createVendorProfile = z.object({
  body: z.object({
    storeName: z.string().min(2, "Store name must be at least 2 characters"),
    description: z.string().optional(),
    returnPolicy: z.string().optional(),
    supportEmail: z.string().email("Invalid email").optional(),
    supportPhone: z.string().optional(),
    logo: z.string().optional(),
    banner: z.string().optional(),
  }),
});

const updateVendorProfile = z.object({
  body: z.object({
    storeName: z.string().min(2).optional(),
    description: z.string().optional(),
    returnPolicy: z.string().optional(),
    supportEmail: z.string().email("Invalid email").optional(),
    supportPhone: z.string().optional(),
    logo: z.string().optional(),
    banner: z.string().optional(),
  }),
});

export const vendorProfileValidation = {
  createVendorProfile,
  updateVendorProfile,
};
