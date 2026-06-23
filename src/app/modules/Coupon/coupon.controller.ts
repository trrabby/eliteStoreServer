import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { couponService } from "./coupon.service";

const createCoupon = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  // console.log(user);
  const data = JSON.parse(req.body.data);
  const result = await couponService.createCoupon(data, user.email);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Coupon created successfully",
    data: result,
  });
});

const getAllCoupons = catchAsync(async (req, res) => {
  const { page, limit, isActive, search, isExpired } = req.query;
  const result = await couponService.getAllCoupons({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    isActive: isActive ? isActive === "true" : undefined,
    isExpired: isExpired ? isExpired === "true" : undefined,
    search: search ? String(search) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupons retrieved successfully",
    data: result,
  });
});

const getMyCoupons = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, isActive } = req.query;
  const result = await couponService.getMyCoupons(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    isActive: isActive ? isActive === "true" : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your coupons retrieved",
    data: result,
  });
});

const getCouponById = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  const result = await couponService.getCouponById(email, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon retrieved successfully",
    data: result,
  });
});

const checkCouponEligibility = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const couponCode = req.params.couponCode;

  const result = await couponService.checkCouponEligibility(email, couponCode);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon discount retrived successfully",
    data: result,
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await couponService.updateCoupon(email, id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon updated successfully",
    data: result,
  });
});

const toggleCouponStatus = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  const result = await couponService.toggleCouponStatus(email, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Coupon ${result.isActive ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

const deleteCoupon = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const id = Number(req.params.id);
  await couponService.deleteCoupon(email, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon deleted successfully",
    data: null,
  });
});

const getMyCouponHistory = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await couponService.getMyCouponHistory(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon history retrieved successfully",
    data: result,
  });
});

export const CouponController = {
  createCoupon,
  getAllCoupons,
  getMyCoupons,
  getCouponById,
  checkCouponEligibility,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getMyCouponHistory,
};
