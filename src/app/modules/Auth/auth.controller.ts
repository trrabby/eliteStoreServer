import config from "../../../config";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AuthService } from "./auth.services";
import httpStatus from "http-status";

const registerUser = catchAsync(async (req, res) => {
  const result = await AuthService.registerUser(req?.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully!",
    data: result,
  });
});

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthService.loginUser(req.body);
  res.cookie("refreshToken", result.refreshToken, {
    secure: config.env == "development",
    httpOnly: true,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User is logged in successful !",
    data: {
      accessToken: result.accessToken,
    },
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await AuthService.getMyProfile(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully!",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;
  const result = await AuthService.refreshToken(refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refresh token generated successfully!",
    data: result,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const user = req?.user;
  const result = await AuthService.changePassword(user as any, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully!",
    data: result,
  });
});

const forgetPassword = catchAsync(async (req, res) => {
  await AuthService.forgetPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Check your email!",
    data: null,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword, email } = req.body;
  const result = await AuthService.resetPassword(token, email, newPassword);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully!",
    data: result,
  });
});

export const AuthController = {
  registerUser,
  getMyProfile,
  loginUser,
  refreshToken,
  changePassword,
  forgetPassword,
  resetPassword,
};
