import { ProductCategory } from "@prisma/client";
import { z } from "zod";

// Define the enum values in Zod
const ProductCategoryEnum = z.enum([
  ProductCategory.GADGETS,
  ProductCategory.CLOTHING,
  ProductCategory.BOOKS,
]);

const createProduct = z.object({
  name: z.string().min(1, { message: "Product name is required" }),
  price: z.preprocess(
    (val) => Number(val),
    z.number().nonnegative({ message: "Price must be 0 or more" })
  ),
  description: z.string().optional(),
  imageUrl: z.string().url({ message: "Invalid image URL" }).optional(),
  category: ProductCategoryEnum,
  companyId: z
    .string()
    .uuid({ message: "Invalid company ID format" })
    .optional(),
});

const updateAProduct = z.object({
  name: z.string().min(1, { message: "Product name is required" }).optional(),
  price: z
    .preprocess(
      (val) => Number(val),
      z.number().nonnegative({ message: "Price must be 0 or more" })
    )
    .optional(),

  description: z.string().optional(),
  imageUrl: z.string().url({ message: "Invalid image URL" }).optional(),
  category: ProductCategoryEnum.optional(),
  isDeleted: z.boolean().optional(),
  companyId: z
    .string()
    .uuid({ message: "Invalid company ID format" })
    .optional(),
});

export const productValidation = {
  createProduct,
  updateAProduct,
};
