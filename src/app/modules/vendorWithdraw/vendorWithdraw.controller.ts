import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { vendorWithdrawService } from "./vendorWithdraw.service";

// Vendor — create request
const createWithdrawRequest = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await vendorWithdrawService.createWithdrawRequest(email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Withdraw request submitted successfully",
    data: result,
  });
});

// Vendor — cancel own request
const cancelWithdrawRequest = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const result = await vendorWithdrawService.cancelWithdrawRequest(
    email,
    publicId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

// ──────────────────────────────────────────────
// VENDOR — Get own withdraw requests
// ──────────────────────────────────────────────
const getMyWithdrawRequests = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, status, reqFrom, reqTo, search } = req.query;

  const result = await vendorWithdrawService.getMyWithdrawRequests(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
    reqFrom: reqFrom ? String(reqFrom) : undefined,
    reqTo: reqTo ? String(reqTo) : undefined,
    search: search ? String(search) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdraw requests retrieved",
    data: result,
  });
});

// ──────────────────────────────────────────────
// ADMIN — Get all withdraw requests
// ──────────────────────────────────────────────
const getAllWithdrawRequests = catchAsync(async (req, res) => {
  const { page, limit, status, search, reqFrom, reqTo } = req.query;

  const result = await vendorWithdrawService.getAllWithdrawRequests({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
    reqFrom: reqFrom ? String(reqFrom) : undefined,
    reqTo: reqTo ? String(reqTo) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All withdraw requests retrieved",
    data: result,
  });
});

// ──────────────────────────────────────────────
// ADMIN & VENDOR — Get single withdraw request by ID
// ──────────────────────────────────────────────
const getSingleWithdrawRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const requestId = Number(id);

  const result = await vendorWithdrawService.getSingleWithdrawRequestById(
    requestId,
    req.user.email,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdraw request retrieved",
    data: result,
  });
});

// Admin — update status
const updateWithdrawStatus = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const data = JSON.parse(req.body.data);
  const result = await vendorWithdrawService.updateWithdrawStatus(
    email,
    publicId,
    data,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Withdraw request ${data.status.toLowerCase()}`,
    data: result,
  });
});

// Admin — get single request
const getWithdrawRequestById = catchAsync(async (req, res) => {
  const { publicId } = req.params;
  const result = await vendorWithdrawService.getWithdrawRequestById(publicId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Request retrieved",
    data: result,
  });
});

export const VendorWithdrawController = {
  createWithdrawRequest,
  cancelWithdrawRequest,
  getMyWithdrawRequests,
  getAllWithdrawRequests,
  getSingleWithdrawRequest,
  updateWithdrawStatus,
  getWithdrawRequestById,
};
