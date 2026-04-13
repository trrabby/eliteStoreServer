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

const loginUser = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

const changePassword = z.object({
  body: z.object({
    oldPassword: z
      .string()
      .min(6, "Old password must be at least 6 characters"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  }),
});

const forgotPassword = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

const resetPassword = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    email: z.string().email("Invalid email format"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const AuthValidation = {
  registerUser,
  loginUser,
  changePassword,
  forgotPassword,
  resetPassword,
};
