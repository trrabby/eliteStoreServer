import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { userService } from "./user.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import {
  AddressType,
  Gender,
  OrderStatus,
  ReturnRequestStatus,
  Role,
  UserFilter,
} from "../../../types/userFilters";

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

// controllers/user.controller.ts
const getAllUsers = catchAsync(async (req, res) => {
  const filter: UserFilter = {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string,
    email: req.query.email as string,
    phone: req.query.phone as string,
    role: req.query.role as Role,
    isBanned:
      req.query.isBanned === "true"
        ? true
        : req.query.isBanned === "false"
          ? false
          : undefined,
    isEmailVerified:
      req.query.isEmailVerified === "true"
        ? true
        : req.query.isEmailVerified === "false"
          ? false
          : undefined,
    isActive:
      req.query.isActive === "true"
        ? true
        : req.query.isActive === "false"
          ? false
          : undefined,
    createdAtFrom: req.query.createdAtFrom as string,
    createdAtTo: req.query.createdAtTo as string,
    lastLoginFrom: req.query.lastLoginFrom as string,
    lastLoginTo: req.query.lastLoginTo as string,
    firstName: req.query.firstName as string,
    lastName: req.query.lastName as string,
    displayName: req.query.displayName as string,
    gender: req.query.gender as Gender,
    ageMin: req.query.ageMin ? Number(req.query.ageMin) : undefined,
    ageMax: req.query.ageMax ? Number(req.query.ageMax) : undefined,
    dobFrom: req.query.dobFrom as string,
    dobTo: req.query.dobTo as string,
    addressCityDistrict: req.query.addressCityDistrict as string,
    addressCountry: req.query.addressCountry as string,
    addressPostalCode: req.query.addressPostalCode as string,
    addressType: req.query.addressType as AddressType,
    addressIsDefault:
      req.query.addressIsDefault === "true"
        ? true
        : req.query.addressIsDefault === "false"
          ? false
          : undefined,
    orderCountMin: req.query.orderCountMin
      ? Number(req.query.orderCountMin)
      : undefined,
    orderCountMax: req.query.orderCountMax
      ? Number(req.query.orderCountMax)
      : undefined,
    orderTotalSpentMin: req.query.orderTotalSpentMin
      ? Number(req.query.orderTotalSpentMin)
      : undefined,
    orderTotalSpentMax: req.query.orderTotalSpentMax
      ? Number(req.query.orderTotalSpentMax)
      : undefined,
    hasDeliveredOrders:
      req.query.hasDeliveredOrders === "true"
        ? true
        : req.query.hasDeliveredOrders === "false"
          ? false
          : undefined,
    hasCancelledOrders:
      req.query.hasCancelledOrders === "true"
        ? true
        : req.query.hasCancelledOrders === "false"
          ? false
          : undefined,
    hasReturnedOrders:
      req.query.hasReturnedOrders === "true"
        ? true
        : req.query.hasReturnedOrders === "false"
          ? false
          : undefined,
    orderStatus: req.query.orderStatus as OrderStatus,
    returnRequestStatus: req.query.returnRequestStatus as ReturnRequestStatus,
    returnRequestCountMin: req.query.returnRequestCountMin
      ? Number(req.query.returnRequestCountMin)
      : undefined,
    returnRequestCountMax: req.query.returnRequestCountMax
      ? Number(req.query.returnRequestCountMax)
      : undefined,
    productInCart:
      typeof req.query.productInCart === "string"
        ? req.query.productInCart.split(",").map(Number)
        : undefined,
    productInWishlist:
      typeof req.query.productInWishlist === "string"
        ? req.query.productInWishlist.split(",").map(Number)
        : undefined,
    orderedProduct:
      typeof req.query.orderedProduct === "string"
        ? req.query.orderedProduct.split(",").map(Number)
        : undefined,
    reviewedProduct:
      typeof req.query.reviewedProduct === "string"
        ? req.query.reviewedProduct.split(",").map(Number)
        : undefined,
    isVendor:
      req.query.isVendor === "true"
        ? true
        : req.query.isVendor === "false"
          ? false
          : undefined,
    vendorVerified:
      req.query.vendorVerified === "true"
        ? true
        : req.query.vendorVerified === "false"
          ? false
          : undefined,
    vendorStoreName: req.query.vendorStoreName as string,
    vendorRatingMin: req.query.vendorRatingMin
      ? Number(req.query.vendorRatingMin)
      : undefined,
    vendorRatingMax: req.query.vendorRatingMax
      ? Number(req.query.vendorRatingMax)
      : undefined,
    vendorTotalSalesMin: req.query.vendorTotalSalesMin
      ? Number(req.query.vendorTotalSalesMin)
      : undefined,
    vendorTotalSalesMax: req.query.vendorTotalSalesMax
      ? Number(req.query.vendorTotalSalesMax)
      : undefined,
    usedCouponCode: req.query.usedCouponCode as string,
    usedCouponId: req.query.usedCouponId
      ? Number(req.query.usedCouponId)
      : undefined,
    hasWrittenReviews:
      req.query.hasWrittenReviews === "true"
        ? true
        : req.query.hasWrittenReviews === "false"
          ? false
          : undefined,
    reviewRatingMin: req.query.reviewRatingMin
      ? Number(req.query.reviewRatingMin)
      : undefined,
    reviewRatingMax: req.query.reviewRatingMax
      ? Number(req.query.reviewRatingMax)
      : undefined,
    reviewCountMin: req.query.reviewCountMin
      ? Number(req.query.reviewCountMin)
      : undefined,
    reviewCountMax: req.query.reviewCountMax
      ? Number(req.query.reviewCountMax)
      : undefined,
    walletBalanceMin: req.query.walletBalanceMin
      ? Number(req.query.walletBalanceMin)
      : undefined,
    walletBalanceMax: req.query.walletBalanceMax
      ? Number(req.query.walletBalanceMax)
      : undefined,
    hasActiveSession:
      req.query.hasActiveSession === "true"
        ? true
        : req.query.hasActiveSession === "false"
          ? false
          : undefined,
    sortBy: req.query.sortBy as string,
    sortOrder: req.query.sortOrder as "asc" | "desc",
  };

  const result = await userService.getAllUsers(filter);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await userService.getMyProfile(email as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const makeAdmin = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const result = await userService.makeAdmin(publicId as string, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User role updated to ADMIN successfully",
    data: result,
  });
});

// Admin: get single user details
const getUserDetails = catchAsync(async (req, res) => {
  const { identifier } = req.params;
  const isId = !isNaN(Number(identifier));
  const user = await userService.getUserByIdOrEmail(
    isId ? Number(identifier) : identifier,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User details retrieved",
    data: user,
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

  const data = JSON.parse(req.body.data);
  // console.log({ data, profileImage });
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

const toggleUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await userService.toggleUserStatus(Number(id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User status toggled successfully",
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
  getUserDetails,
  getMyProfile,
  makeAdmin,
  updateMyProfile,
  toggleUserStatus,
  deleteAProfile,
  // address
  addAddress,
  getMyAddresses,
  getSingleAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
