import { z } from "zod";

const createBrand = z.object({
  body: z.object({
    name: z.string().min(2, "Brand name must be at least 2 characters"),
    description: z.string().optional(),
    website: z.string().url("Invalid URL").optional(),
    country: z.string().optional(),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    logo: z.string().optional(), // injected by multer
    banner: z.string().optional(), // injected by multer
  }),
});

const updateBrand = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    website: z.string().url("Invalid URL").optional(),
    country: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    logo: z.string().optional(),
    banner: z.string().optional(),
  }),
});

export const brandValidation = {
  createBrand,
  updateBrand,
};
