import { z } from "zod";

const addToCart = z.object({
  body: z.object({
    productId: z.number().int().positive("Product ID is required"),
    variantId: z.number().int().positive("Variant ID is required"),
    quantity:  z.number().int().min(1, "Quantity must be at least 1").default(1),
  }),
});

const updateCartItem = z.object({
  body: z.object({
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
  }),
});

export const cartValidation = {
  addToCart,
  updateCartItem,
};