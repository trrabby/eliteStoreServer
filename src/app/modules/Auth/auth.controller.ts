import config from "../../../config";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

import AppError from "../../errors/AppError";
import {
  verifyGithubToken,
  verifyGoogleToken,
} from "../../utils/ProvidersTokenVerify";
import { AuthService } from "./auth.services";
import httpStatus from "http-status";

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthService.loginUser(req.body, req); // ← pass req

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully!",
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});

const loginOrRegisterViaGoogle = catchAsync(async (req, res) => {
  const providerToken = req.headers.authorization;

  if (!providerToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, "No token provided");
  }

  const DataFromProvider = await verifyGoogleToken(providerToken);
  const {
    email,
    name: firstName,
    given_name: lastName,
    imgUrl: avatar,
    verified_email,
  }: any = DataFromProvider;

  if (!verified_email) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Google account is not verified",
    );
  }

  if (!email) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Could not retrieve email from Google",
    );
  }

  const result = await AuthService.loginOrRegisterViaProvider(
    {
      email,
      firstName,
      lastName,
      avatar,
      provider: "google",
    },
    req,
  );

  res.cookie("refreshToken", result.refreshToken, {
    secure: config.env === "production",
    httpOnly: true,
  });

  sendResponse(res, {
    statusCode: result.isNewUser ? httpStatus.CREATED : httpStatus.OK,
    success: true,
    message: result.isNewUser
      ? "Account created and logged in via Google!"
      : "Logged in successfully via Google!",
    data: { accessToken: result.accessToken },
  });
});

const loginOrRegisterViaGithub = catchAsync(async (req, res) => {
  const providerToken = req.headers.authorization;

  if (!providerToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, "No token provided");
  }

  const DataFromProvider = await verifyGithubToken(providerToken);
  const { email, firstName, lastName, avatar }: any = DataFromProvider;

  if (!email) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "GitHub account has no public email. Please add a public email to your GitHub profile.",
    );
  }

  const result = await AuthService.loginOrRegisterViaProvider(
    {
      email,
      firstName,
      lastName,
      avatar,
      provider: "github",
    },
    req,
  );

  res.cookie("refreshToken", result.refreshToken, {
    secure: config.env === "production",
    httpOnly: true,
  });

  sendResponse(res, {
    statusCode: result.isNewUser ? httpStatus.CREATED : httpStatus.OK,
    success: true,
    message: result.isNewUser
      ? "Account created and logged in via GitHub!"
      : "Logged in successfully via GitHub!",
    data: { accessToken: result.accessToken },
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

const logout = catchAsync(async (req, res) => {
  await AuthService.logout(req);
  res.clearCookie("refreshToken");
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

export const AuthController = {
  loginUser,
  loginOrRegisterViaGoogle,
  loginOrRegisterViaGithub,
  getMyProfile,
  refreshToken,
  changePassword,
  forgetPassword,
  resetPassword,
  logout,
};
