import { z } from "zod";

const createProduct = z.object({
  body: z.object({
    name:             z.string().min(2, "Product name must be at least 2 characters"),
    shortDescription: z.string().optional(),
    description:      z.string().optional(),
    brandId:          z.number().optional(),
    categoryIds:      z.array(z.number()).min(1, "At least one category is required"),
    tags:             z.array(z.string()).default([]),
    status:           z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED", "ARCHIVED"]).default("DRAFT"),
    isFeatured:       z.boolean().default(false),
    metaTitle:        z.string().optional(),
    metaDesc:         z.string().optional(),
    metaKeywords:     z.string().optional(),
  }),
});

const updateProduct = z.object({
  body: z.object({
    name:             z.string().min(2).optional(),
    shortDescription: z.string().optional(),
    description:      z.string().optional(),
    brandId:          z.number().nullable().optional(),
    categoryIds:      z.array(z.number()).optional(),
    tags:             z.array(z.string()).optional(),
    status:           z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED", "ARCHIVED"]).optional(),
    isFeatured:       z.boolean().optional(),
    metaTitle:        z.string().optional(),
    metaDesc:         z.string().optional(),
    metaKeywords:     z.string().optional(),
  }),
});

const createVariant = z.object({
  body: z.object({
    sku:          z.string().min(1, "SKU is required"),
    name:         z.string().optional(),
    price:        z.number().positive("Price must be positive"),
    comparePrice: z.number().positive().optional(),
    costPrice:    z.number().positive().optional(),
    stock:        z.number().int().min(0).default(0),
    lowStockAlert: z.number().int().min(0).default(5),
    weight:       z.number().positive().optional(),
    barcode:      z.string().optional(),
    isDefault:    z.boolean().default(false),
    isActive:     z.boolean().default(true),
    // option values e.g. [{ optionName: "Color", value: "Red" }]
    options: z.array(
      z.object({
        optionName: z.string().min(1),
        value:      z.string().min(1),
      })
    ).default([]),
  }),
});

const updateVariant = z.object({
  body: z.object({
    sku:           z.string().optional(),
    name:          z.string().optional(),
    price:         z.number().positive().optional(),
    comparePrice:  z.number().positive().nullable().optional(),
    costPrice:     z.number().positive().nullable().optional(),
    stock:         z.number().int().min(0).optional(),
    lowStockAlert: z.number().int().min(0).optional(),
    weight:        z.number().positive().nullable().optional(),
    barcode:       z.string().nullable().optional(),
    isDefault:     z.boolean().optional(),
    isActive:      z.boolean().optional(),
  }),
});

const updateStock = z.object({
  body: z.object({
    change:  z.number().int(),               // positive = restock, negative = reduce
    reason:  z.string().optional(),
  }),
});

const addAttribute = z.object({
  body: z.object({
    name:  z.string().min(1, "Attribute name is required"),
    value: z.string().min(1, "Attribute value is required"),
  }),
});

const addRelatedProducts = z.object({
  body: z.object({
    relatedProductIds: z.array(z.number()).min(1),
  }),
});

export const productValidation = {
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  updateStock,
  addAttribute,
  addRelatedProducts,
};