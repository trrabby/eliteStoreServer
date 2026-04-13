import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { userService } from "./user.service";

const registerUser = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);
  const result = await userService.registerUser(data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully!",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await userService.getAllUsers();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const { publicId } = req.params;
  const result = await userService.getMyProfile(publicId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const makeAdmin = catchAsync(async (req, res) => {
  const { publicId } = req.params;
  const result = await userService.makeAdmin(publicId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User role updated to ADMIN successfully",
    data: result,
  });
});

const getAnAccountByEmail = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await userService.getAccountByEmail(email as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account retrieved successfully",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  // console.log(email);
  const result = await userService.updateMyProfile(email, req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const deleteAProfile = catchAsync(async (req, res) => {
  const { publicId } = req.params;
  await userService.deleteAProfile(publicId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile deleted successfully",
    data: null,
  });
});

export const UserController = {
  registerUser,
  getAllUsers,
  getMyProfile,
  makeAdmin,
  getAnAccountByEmail,
  updateMyProfile,
  deleteAProfile,
};
