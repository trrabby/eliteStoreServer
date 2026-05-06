import { z } from "zod";

const createFlashSale = z.object({
  body: z
    .object({
      title: z.string().min(3, "Title must be at least 3 characters"),
      description: z.string().optional(),
      startsAt: z.string().datetime("Invalid start date"),
      endsAt: z.string().datetime("Invalid end date"),
    })
    .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
      message: "End date must be after start date",
      path: ["endsAt"],
    })
    .refine((d) => new Date(d.startsAt) > new Date(), {
      message: "Start date must be in the future",
      path: ["startsAt"],
    }),
});

const updateFlashSale = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  }),
});

const addItems = z.object({
  body: z
    .object({
      items: z
        .array(
          z.object({
            productId: z.number().int().positive("Product ID required"),
            discountType: z.enum(["PERCENTAGE", "FLAT"]),
            discountValue: z.number().positive("Discount must be positive"),
            maxDiscount: z.number().positive().optional(),
            stock: z.number().int().min(1).optional(),
          }),
        )
        .min(1, "At least one product is required"),
    })
    .refine(
      (d) => {
        const pctItems = d.items.filter((i) => i.discountType === "PERCENTAGE");
        return pctItems.every((i) => i.discountValue <= 100);
      },
      { message: "Percentage discount cannot exceed 100%", path: ["items"] },
    ),
});

const updateItem = z.object({
  body: z.object({
    discountType: z.enum(["PERCENTAGE", "FLAT"]).optional(),
    discountValue: z.number().positive().optional(),
    maxDiscount: z.number().positive().nullable().optional(),
    stock: z.number().int().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

const activateSale = z.object({
  body: z.object({
    confirm: z.literal(true, {
      errorMap: () => ({ message: "Please confirm activation" }),
    }),
  }),
});

export const flashSaleValidation = {
  createFlashSale,
  updateFlashSale,
  addItems,
  updateItem,
  activateSale,
};
