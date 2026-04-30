import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { userService } from "./user.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

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

  const file = req.file as Express.Multer.File | undefined;

  let profileImage: string | undefined;

  if (file) {
    const result: any = await uploadToCloudinary(file.buffer, "profiles");
    profileImage = result.secure_url;
  }

  const data = req.body; // already parsed JSON or form-data fields
  // console.log(profileImage);
  const result = await userService.updateMyProfile(email, {
    ...data,
    profileImage,
  });

  return sendResponse(res, {
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

// ─────────────────────────────────────────
// ADDRESS
// ─────────────────────────────────────────

const addAddress = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await userService.addAddress(email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Address added successfully",
    data: result,
  });
});

const getMyAddresses = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await userService.getMyAddresses(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Addresses retrieved successfully",
    data: result,
  });
});

const getSingleAddress = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const addressId = Number(req.params.addressId);
  const result = await userService.getSingleAddress(email, addressId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Address retrieved successfully",
    data: result,
  });
});

const updateAddress = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const addressId = Number(req.params.addressId);
  const data = JSON.parse(req.body.data);
  const result = await userService.updateAddress(email, addressId, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Address updated successfully",
    data: result,
  });
});

const setDefaultAddress = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const addressId = Number(req.params.addressId);
  const result = await userService.setDefaultAddress(email, addressId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Default address updated successfully",
    data: result,
  });
});

const deleteAddress = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const addressId = Number(req.params.addressId);
  await userService.deleteAddress(email, addressId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Address deleted successfully",
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
  // address
  addAddress,
  getMyAddresses,
  getSingleAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
