import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { categoryService } from "./category.service";

const createCategory = catchAsync(async (req, res) => {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const image = files?.["image"]
    ? (files["image"][0].path as string)
    : undefined;
  const icon = files?.["icon"] ? (files["icon"][0].path as string) : undefined;
  const data = JSON.parse(req.body.data);
  const result = await categoryService.createCategory(data, image, icon);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const getCategoryTree = catchAsync(async (req, res) => {
  const result = await categoryService.getCategoryTree();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category tree retrieved successfully",
    data: result,
  });
});

const getAllCategoriesFlat = catchAsync(async (req, res) => {
  const { page, limit, depth, isActive, search } = req.query;
  const result = await categoryService.getAllCategoriesFlat({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    depth: depth ? Number(depth) : undefined,
    isActive: isActive ? isActive === "true" : undefined,
    search: search ? String(search) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories retrieved successfully",
    data: result,
  });
});

const getCategoryBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const result = await categoryService.getCategoryBySlug(slug);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category retrieved successfully",
    data: result,
  });
});

const getCategoryById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  console.log(id);
  const result = await categoryService.getCategoryById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category retrieved successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const image = files?.["image"]
    ? (files["image"][0].path as string)
    : undefined;
  const icon = files?.["icon"] ? (files["icon"][0].path as string) : undefined;
  const data = JSON.parse(req.body.data);
  const result = await categoryService.updateCategory(id, data, image, icon);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await categoryService.deleteCategory(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category deleted successfully",
    data: null,
  });
});

export const CategoryController = {
  createCategory,
  getCategoryTree,
  getAllCategoriesFlat,
  getCategoryBySlug,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
