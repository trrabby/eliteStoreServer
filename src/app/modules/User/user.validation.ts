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

// used with validateRequestFormdataOptionalPhoto — no body wrapper
// because the middleware manually parses and passes the object directly
const updateUser = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name cannot be empty").optional(),
    lastName: z.string().min(1, "Last name cannot be empty").optional(),
    displayName: z.string().optional(),
    avatar: z.string().url("Invalid URL format").optional(),
    imgUrl: z.string().optional(), // injected by validateRequestFormdataOptionalPhoto
    bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  }),
});

export const userValidation = {
  registerUser,
  updateUser,
};
