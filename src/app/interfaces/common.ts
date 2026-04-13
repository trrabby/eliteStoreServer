import { Role } from "@prisma/client";

export type IAuthUser = {
  email: string;
  role: Role;
} | null;
