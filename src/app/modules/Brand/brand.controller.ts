import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { brandService } from "./brand.service";

const createBrand = catchAsync(async (req, res) => {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const logo = files?.["logo"] ? files["logo"][0].path : undefined;
  const banner = files?.["banner"] ? files["banner"][0].path : undefined;
  const data = JSON.parse(req.body.data);
  const result = await brandService.createBrand(data, logo, banner);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Brand created successfully",
    data: result,
  });
});

const getAllBrands = catchAsync(async (req, res) => {
  const { page, limit, isActive, isFeatured, search, country } = req.query;
  const result = await brandService.getAllBrands({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    isActive: isActive ? isActive === "true" : undefined,
    isFeatured: isFeatured ? isFeatured === "true" : undefined,
    search: search ? String(search) : undefined,
    country: country ? String(country) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brands retrieved successfully",
    data: result,
  });
});

const getFeaturedBrands = catchAsync(async (req, res) => {
  const result = await brandService.getFeaturedBrands();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Featured brands retrieved successfully",
    data: result,
  });
});

const getBrandBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const result = await brandService.getBrandBySlug(slug);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand retrieved successfully",
    data: result,
  });
});

const getBrandById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await brandService.getBrandById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand retrieved successfully",
    data: result,
  });
});

const updateBrand = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const logo = files?.["logo"] ? files["logo"][0].path : undefined;
  const banner = files?.["banner"] ? files["banner"][0].path : undefined;
  const data = JSON.parse(req.body.data);
  const result = await brandService.updateBrand(id, data, logo, banner);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand updated successfully",
    data: result,
  });
});

const toggleFeatured = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await brandService.toggleFeatured(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Brand ${result.isFeatured ? "marked as featured" : "removed from featured"}`,
    data: result,
  });
});

const deleteBrand = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await brandService.deleteBrand(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Brand ${result.name} deleted successfully`,
    data: null,
  });
});

export const BrandController = {
  createBrand,
  getAllBrands,
  getFeaturedBrands,
  getBrandBySlug,
  getBrandById,
  updateBrand,
  toggleFeatured,
  deleteBrand,
};
