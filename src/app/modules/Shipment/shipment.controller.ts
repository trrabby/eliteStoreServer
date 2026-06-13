import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { shipmentService } from "./shipment.service";

const createShipment = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await shipmentService.createShipment(email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Shipment created successfully",
    data: result,
  });
});

// ─── Steadfast ───────────────────────────

const createSteadfastShipments = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);
  const { email } = req.user as { email: string };
  const result = await shipmentService.createSteadfastShipments(
    email,
    data.orderIds,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `${result.successCount} shipment(s) created via Steadfast. ${result.failedCount} failed.`,
    data: result,
  });
});

const syncSteadfastStatuses = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);
  const result = await shipmentService.syncSteadfastStatuses(data.shipmentIds);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${result.updated.length} updated, ${result.skipped.length} skipped, ${result.failed.length} failed.`,
    data: result,
  });
});

const getSteadfastAccountBalance = catchAsync(async (req, res) => {
  const result = await shipmentService.getSteadfastAccountBalance();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Steadfast balance retrieved",
    data: result,
  });
});

// ─── Bulk status updates ──────────────────

const markOutForDelivery = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await shipmentService.markOutForDelivery(
    email,
    data.shipmentIds,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${result.updatedCount} shipment(s) marked as out for delivery. ${result.skippedCount} skipped.`,
    data: result,
  });
});

const markDelivered = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await shipmentService.markDelivered(
    email,
    data.shipmentIds,
    data.deliveredAt,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${result.updatedCount} shipment(s) marked as delivered. ${result.skippedCount} skipped.`,
    data: result,
  });
});

// ─── Read ────────────────────────────────

const getShipmentByOrderId = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const orderId = Number(req.params.orderId);
  const result = await shipmentService.getShipmentByOrderId(email, orderId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment retrieved successfully",
    data: result,
  });
});

const trackByTrackingNumber = catchAsync(async (req, res) => {
  const { trackingNumber } = req.params;
  const result = await shipmentService.trackByTrackingNumber(trackingNumber);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment tracked successfully",
    data: result,
  });
});

const getAllShipments = catchAsync(async (req, res) => {
  const { page, limit, carrier, search, dateFrom, dateTo } = req.query;
  const result = await shipmentService.getAllShipments({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    carrier: carrier ? String(carrier) : undefined,
    search: search ? String(search) : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipments retrieved successfully",
    data: result,
  });
});

const getVendorShipments = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, carrier, search, dateFrom, dateTo } = req.query;
  const result = await shipmentService.getVendorShipments(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    carrier: carrier ? String(carrier) : undefined,
    search: search ? String(search) : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor shipments retrieved successfully",
    data: result,
  });
});

const updateShipment = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const shipmentId = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await shipmentService.updateShipment(email, shipmentId, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment updated successfully",
    data: result,
  });
});

const getShipmentStats = catchAsync(async (req, res) => {
  const result = await shipmentService.getShipmentStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment stats retrieved successfully",
    data: result,
  });
});

export const ShipmentController = {
  createShipment,
  createSteadfastShipments,
  syncSteadfastStatuses,
  getSteadfastAccountBalance,
  markOutForDelivery,
  markDelivered,
  getShipmentByOrderId,
  trackByTrackingNumber,
  getAllShipments,
  getVendorShipments,
  updateShipment,
  getShipmentStats,
};
