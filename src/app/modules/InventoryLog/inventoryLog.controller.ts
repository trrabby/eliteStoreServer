import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { inventoryLogService } from "./inventoryLog.service";

const getAllInventoryLogs = catchAsync(async (req, res) => {
  const { page, limit, variantId, productId, reason, dateFrom, dateTo } =
    req.query;

  const result = await inventoryLogService.getAllInventoryLogs({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    variantId: variantId ? Number(variantId) : undefined,
    productId: productId ? Number(productId) : undefined,
    reason: reason ? String(reason) : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inventory logs retrieved successfully",
    data: result,
  });
});

const getVariantInventoryLogs = catchAsync(async (req, res) => {
  const variantId = Number(req.params.variantId);
  const { page, limit } = req.query;
  const result = await inventoryLogService.getVariantInventoryLogs(variantId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Variant inventory logs retrieved successfully",
    data: result,
  });
});

const getLowStockVariants = catchAsync(async (req, res) => {
  const { page, limit, threshold } = req.query;
  const result = await inventoryLogService.getLowStockVariants({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    threshold: threshold ? Number(threshold) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Low stock variants retrieved successfully",
    data: result,
  });
});

const getOutOfStockVariants = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await inventoryLogService.getOutOfStockVariants({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Out of stock variants retrieved successfully",
    data: result,
  });
});

const getInventoryStats = catchAsync(async (req, res) => {
  const result = await inventoryLogService.getInventoryStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inventory stats retrieved successfully",
    data: result,
  });
});

export const InventoryLogController = {
  getAllInventoryLogs,
  getVariantInventoryLogs,
  getLowStockVariants,
  getOutOfStockVariants,
  getInventoryStats,
};
