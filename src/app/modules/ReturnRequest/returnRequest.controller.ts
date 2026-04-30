import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { returnRequestService } from "./returnRequest.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

const createReturnRequest = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const files = req.files as Express.Multer.File[] | undefined;

  // parse structured body
  const data = JSON.parse(req.body.data);

  let images: string[] = [];

  if (files?.length) {
    const uploaded = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, "returns")),
    );

    images = uploaded.map((img: any) => img.secure_url);
  }
  const result = await returnRequestService.createReturnRequest(
    email,
    data,
    images,
  );

  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Return request submitted successfully",
    data: result,
  });
});

const getAllReturnRequests = catchAsync(async (req, res) => {
  const { page, limit, status, reason, search, dateFrom, dateTo } = req.query;

  const result = await returnRequestService.getAllReturnRequests({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
    reason: reason ? String(reason) : undefined,
    search: search ? String(search) : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return requests retrieved successfully",
    data: result,
  });
});

const getMyReturnRequests = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, status } = req.query;

  const result = await returnRequestService.getMyReturnRequests(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return requests retrieved successfully",
    data: result,
  });
});

const getReturnRequestById = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  const result = await returnRequestService.getReturnRequestById(id, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return request retrieved successfully",
    data: result,
  });
});

const processReturn = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await returnRequestService.processReturn(id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: typeof result === "string" ? result : result.message,
    data: result,
  });
});

const updateReturnStatus = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await returnRequestService.updateReturnStatus(id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return request status updated",
    data: result,
  });
});

const cancelReturnRequest = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  await returnRequestService.cancelReturnRequest(email, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return request cancelled",
    data: null,
  });
});

const getReturnStats = catchAsync(async (req, res) => {
  const result = await returnRequestService.getReturnStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Return stats retrieved successfully",
    data: result,
  });
});

export const ReturnRequestController = {
  createReturnRequest,
  getAllReturnRequests,
  getMyReturnRequests,
  getReturnRequestById,
  processReturn,
  updateReturnStatus,
  cancelReturnRequest,
  getReturnStats,
};
