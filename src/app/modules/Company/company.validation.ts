import { z } from "zod";

const createCompany = z.object({
  name: z.string().min(1, { message: "Company name is required" }).optional(),
  accountId: z.string().uuid({ message: "Invalid account ID format" }),
  website: z.string().url({ message: "Invalid website URL" }).optional(),
  companyImage: z.string().url({ message: "Invalid image URL" }).optional(),
  description: z.string().optional(),
});

const updateCompany = z.object({
  name: z.string().min(1, { message: "Company name is required" }).optional(),
  website: z.string().url({ message: "Invalid website URL" }).optional(),
  companyImage: z.string().url({ message: "Invalid image URL" }).optional(),
  description: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export const CompanyValidation = {
  createCompany,
  updateCompany,
};
