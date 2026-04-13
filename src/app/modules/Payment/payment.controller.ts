import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import { PaymentService } from "./payment.services";

// get Payment
const getPayment = catchAsync(async (req, res) => {
  const result = await PaymentService.getPayments();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment Info get successfully",
    data: result,
  });
});

const initPayment = catchAsync(async (req, res) => {
  const result = await PaymentService.initPayment(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment initialization successful",
    data: result,
  });
});

const validatePayment = catchAsync(async (req, res) => {
  const result = await PaymentService.validatePayment(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment validate successfully",
    data: result,
  });
});

export const PaymentController = {
  getPayment,
  initPayment,
  validatePayment,
};
