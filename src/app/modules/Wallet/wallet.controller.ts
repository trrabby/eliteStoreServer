import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { walletService } from "./wallet.service";

const getWallet = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await walletService.getWallet(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wallet retrieved successfully",
    data: result,
  });
});

const getTransactionHistory = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, type, reason } = req.query;
  const result = await walletService.getTransactionHistory(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    type: type ? String(type) : undefined,
    reason: reason ? String(reason) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Transaction history retrieved successfully",
    data: result,
  });
});

const initiateAddMoney = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);

  if (data.method === "SSLCOMMERZ") {
    const result = await walletService.initiateAddMoneySSL(email, data.amount);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Redirect to payment gateway",
      data: result,
    });
  }

  if (data.method === "BKASH") {
    const result = await walletService.initiateAddMoneyBkash(
      email,
      data.amount,
      data.mobileNumber,
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Redirect to bKash",
      data: result,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.BAD_REQUEST,
    success: false,
    message: "Unsupported payment method",
    data: null,
  });
});

// SSL callbacks for wallet
const walletSSLSuccess = catchAsync(async (req, res) => {
  await walletService.handleWalletSSLSuccess(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/wallet?topup=success`);
});

const walletSSLFail = catchAsync(async (req, res) => {
  await walletService.handleWalletSSLFail(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/wallet?topup=failed`);
});

const walletSSLCancel = catchAsync(async (req, res) => {
  await walletService.handleWalletSSLFail(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/wallet?topup=cancelled`);
});

// bKash callback for wallet
const walletBkashCallback = catchAsync(async (req, res) => {
  const { paymentID, status } = req.query as {
    paymentID: string;
    status: string;
  };

  try {
    await walletService.handleWalletBkashCallback({ paymentID, status });
    res.redirect(`${process.env.FRONTEND_URL}/wallet?topup=success`);
  } catch {
    res.redirect(`${process.env.FRONTEND_URL}/wallet?topup=failed`);
  }
});

const transferToWallet = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await walletService.transferToWallet(
    email,
    data.recipientEmail,
    data.amount,
    data.note,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const getAllWallets = catchAsync(async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await walletService.getAllWallets({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search ? String(search) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wallets retrieved successfully",
    data: result,
  });
});

const adminCreditWallet = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);
  const result = await walletService.adminCreditWallet(
    data.userId,
    data.amount,
    data.reason,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

const getWalletStats = catchAsync(async (req, res) => {
  const result = await walletService.getWalletStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wallet stats retrieved successfully",
    data: result,
  });
});

const getAllTransactions = catchAsync(async (req, res) => {
  const { page, limit, type, reason, status, userId } = req.query;
  const result = await walletService.getAllTransactions({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    type: type ? String(type) : undefined,
    reason: reason ? String(reason) : undefined,
    status: status ? String(status) : undefined,
    userId: userId ? Number(userId) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Transactions retrieved successfully",
    data: result,
  });
});

export const WalletController = {
  getWallet,
  getTransactionHistory,
  initiateAddMoney,
  walletSSLSuccess,
  walletSSLFail,
  walletSSLCancel,
  walletBkashCallback,
  transferToWallet,
  getAllWallets,
  adminCreditWallet,
  getWalletStats,
  getAllTransactions,
};
