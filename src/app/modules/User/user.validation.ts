import { z } from "zod";

// Update user validation
export const updateUser = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  profileImage: z.string().url("Invalid URL format").optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
});

// Export validation schema
export const userValidation = {
  updateUser,
};
