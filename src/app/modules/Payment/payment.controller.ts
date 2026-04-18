import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { paymentService } from "./payment.service";
import config from "../../../config";

// initiate payment
const initiatePayment = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await paymentService.initiatePayment(email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment initiated",
    data: result,
  });
});

// ── SSLCommerz callbacks ──

const sslSuccess = catchAsync(async (req, res) => {
  const result = await paymentService.handleSSLSuccess(req.body);
  // redirect to frontend success page
  res.redirect(
    `${process.env.FRONTEND_URL}/payment/success?orderNumber=${result.orderNumber}`,
  );
});

const sslFail = catchAsync(async (req, res) => {
  await paymentService.handleSSLFail(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
});

const sslCancel = catchAsync(async (req, res) => {
  await paymentService.handleSSLCancel(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/payment/cancelled`);
});

const sslIpn = catchAsync(async (req, res) => {
  await paymentService.handleSSLIpn(req.body);
  res.status(httpStatus.OK).json({ received: true });
});

// ── bKash callback ──

const bkashCallback = catchAsync(async (req, res) => {
  const { paymentID, status } = req.query as {
    paymentID: string;
    status: string;
  };
  const orderId = req.query.orderId as string;

  try {
    const result = await paymentService.handleBkashCallback({
      paymentID,
      status,
      orderId,
    });
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/success?orderNumber=${result.orderNumber}`,
    );
  } catch {
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
});

// ── Nagad callback ──

const nagadCallback = catchAsync(async (req, res) => {
  const query = req.query as {
    payment_ref_id: string;
    order_id: string;
    status: string;
  };

  try {
    const result = await paymentService.handleNagadCallback(query);
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/success?orderNumber=${result.orderNumber}`,
    );
  } catch {
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
});

// get payment by order id
const getPaymentByOrderId = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const orderId = Number(req.params.orderId);
  const result = await paymentService.getPaymentByOrderId(email, orderId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully",
    data: result,
  });
});

// get all payments — admin
const getAllPayments = catchAsync(async (req, res) => {
  const { page, limit, status, method } = req.query;
  const result = await paymentService.getAllPayments({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
    method: method ? String(method) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    data: result,
  });
});

// initiate refund — admin
const initiateRefund = catchAsync(async (req, res) => {
  const orderId = Number(req.params.orderId);
  const result = await paymentService.initiateRefund(orderId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

export const PaymentController = {
  initiatePayment,
  sslSuccess,
  sslFail,
  sslCancel,
  sslIpn,
  bkashCallback,
  nagadCallback,
  getPaymentByOrderId,
  getAllPayments,
  initiateRefund,
};
