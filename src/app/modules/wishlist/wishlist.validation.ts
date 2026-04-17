import { z } from "zod";

const addToWishlist = z.object({
  body: z.object({
    productId: z.number().int().positive("Product ID is required"),
  }),
});

export const wishlistValidation = {
  addToWishlist,
};