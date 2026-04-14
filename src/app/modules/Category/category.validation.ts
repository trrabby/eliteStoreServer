import { z } from "zod";

const createCategory = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    parentId: z.number().optional(), // null = root categor
    sortOrder: z.number().default(0),
    isActive: z.boolean().default(true),
    metaTitle: z.string().optional(),
    metaDesc: z.string().optional(),
    image: z.string().optional(), // injected by multer
    icon: z.string().optional(),
  }),
});

const updateCategory = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional(),
    isActive: z.boolean().optional(),
    metaTitle: z.string().optional(),
    metaDesc: z.string().optional(),
    image: z.string().optional(),
    icon: z.string().optional(),
  }),
});

export const categoryValidation = {
  createCategory,
  updateCategory,
};
