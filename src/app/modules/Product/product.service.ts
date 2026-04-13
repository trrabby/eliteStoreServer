import httpStatus from "http-status";
import { Request } from "express";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { Product } from "@prisma/client";
import { fileUploader } from "../../../helpers/fileUploader";
import { IFile } from "../../interfaces/file";

/// create product
const createProduct = async (req: Request) => {
  const { email } = req.user;

  await prisma.account.findUniqueOrThrow({
    where: { email },
  });

  const file = req.file as IFile;

  if (req.file) {
    const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
    req.body.imageUrl = uploadToCloudinary?.secure_url;
  }
  const { name, price, description, category } = req.body;
  const imageUrl = req.file?.path;

  const result = await prisma.product.create({
    data: {
      name,
      price: parseFloat(price),
      description,
      category,
      imageUrl,
    },
  });

  return result;
};

/////   TO DO pagination and filter add Later
const getProducts = async () => {
  const result = await prisma.product.findMany({
    orderBy: {
      createdAt: "desc", // latest products first
    },
    include: {
      reviews: {
        orderBy: {
          createdAt: "desc", // latest reviews first
        },
        include: {
          votes: true,
          ReviewComment: true,
          account: true,
        },
      },
    },
  });
  return result;
};

const getAProduct = async (id: string) => {
  const result = await prisma.product.findUniqueOrThrow({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      reviews: {
        orderBy: {
          createdAt: "desc", // newest reviews first
        },
        include: {
          votes: true,
          ReviewComment: true,
          account: true,
        },
      },
    },
  });

  return result;
};

const updateAProduct = async (id: string, data: Partial<Product>) => {
  await prisma.product.findUniqueOrThrow({
    where: { id },
  });

  if (!data || Object.keys(data).length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "No data provided to update");
  }

  const result = await prisma.product.update({
    where: { id },
    data,
  });

  return result;
};

const deleteAProduct = async (id: string) => {
  await prisma.product.findUniqueOrThrow({ where: { id: id } });

  const result = await prisma.product.update({
    where: { id: id, isDeleted: false },
    data: { isDeleted: true },
  });
  return result;
};

export const ProductService = {
  createProduct,
  getProducts,
  getAProduct,
  updateAProduct,
  deleteAProduct,
};
