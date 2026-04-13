import httpStatus from "http-status";
import { Request } from "express";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import uploadCloud from "../../../shared/cloudinary";
import { Company } from "@prisma/client";

const createCompany = async (req: Request) => {
  const { email } = req.user;

  const isAccountExist = await prisma.account.findUnique({
    where: { email },
  });

  if (!isAccountExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const isCompanyExist = await prisma.company.findUnique({
    where: { accountId: isAccountExist.id },
  });

  if (isCompanyExist) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Company already exists for this account"
    );
  }

  if (req.file) {
    const uploadedImage = await uploadCloud(req.file);
    req.body.companyImage = uploadedImage?.secure_url;
  }

  const company = await prisma.company.create({
    data: {
      ...req.body,
      accountId: isAccountExist.id,
    },
  });

  return company;
};

// /////   TO DO pagination and filter add Later
const getCompany = async () => {
  const result = await prisma.company.findMany();
  return result;
};

// get A Company
const getACompany = async (id: string) => {
  const result = await prisma.company.findUniqueOrThrow({
    where: {
      id,
      isDeleted: false,
    },
  });

  return result;
};

// update A Company
const updateACompany = async (id: string, data: Company) => {
  await prisma.company.findUniqueOrThrow({
    where: { id: id },
  });

  const result = await prisma.company.update({
    where: { id: id },
    data: data,
  });
  return result;
};

//delete A Company
const deleteACompany = async (id: string) => {
  await prisma.company.findUniqueOrThrow({ where: { id: id } });

  const result = await prisma.company.update({
    where: { id: id, isDeleted: false },
    data: { isDeleted: true },
  });
  return result;
};

export const CompanyService = {
  createCompany,
  getCompany,
  getACompany,
  updateACompany,
  deleteACompany,
};
