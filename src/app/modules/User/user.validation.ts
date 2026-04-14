import { z } from "zod";

const registerUser = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
  }),
});

const updateUser = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name cannot be empty").optional(),
    lastName: z.string().min(1, "Last name cannot be empty").optional(),
    displayName: z.string().optional(),
    imgUrl: z.string().optional(),
    bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  }),
});

const addAddress = z.object({
  body: z.object({
    type: z
      .enum(["HOME", "OFFICE", "BILLING", "SHIPPING", "OTHER"])
      .default("HOME"),
    label: z.string().optional(),
    fullName: z.string().min(1, "Full name is required"),
    phone: z.string().min(1, "Phone is required"),
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    city_district: z.string().min(1, "City or district is required"),
    postalCode: z.string().optional(),
    country: z.string().default("BD"),
    isDefault: z.boolean().default(false),
    landmark: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

const updateAddress = z.object({
  body: z.object({
    type: z.enum(["HOME", "OFFICE", "BILLING", "SHIPPING", "OTHER"]).optional(),
    label: z.string().optional(),
    fullName: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    addressLine1: z.string().min(1).optional(),
    addressLine2: z.string().optional(),
    city_district: z.string().min(1).optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    isDefault: z.boolean().optional(),
    landmark: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

export const userValidation = {
  registerUser,
  updateUser,
  addAddress,
  updateAddress,
};
