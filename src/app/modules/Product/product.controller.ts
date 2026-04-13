import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ProductService } from "./product.service";
import { Request } from "express";

// create a product
const createProduct = catchAsync(async (req, res) => {
  const result = await ProductService.createProduct(req as Request);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

// get product
const getProducts = catchAsync(async (req, res) => {
  const result = await ProductService.getProducts();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product get successfully",
    data: result,
  });
});

/// get a product
const getAProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductService.getAProduct(id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product a get successfully",
    data: result,
  });
});

/// update A Product
const updateAProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductService.updateAProduct(id as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

/// update A Product
const deleteAProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductService.deleteAProduct(id as string);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

export const ProductController = {
  createProduct,
  getProducts,
  getAProduct,
  updateAProduct,
  deleteAProduct,
};
