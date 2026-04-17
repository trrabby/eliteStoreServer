import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { couponService } from "./coupon.service";

const createCoupon = catchAsync(async (req, res) => {
  const data   = JSON.parse(req.body.data);
  const result = await couponService.createCoupon(data);
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
    page:      page      ? Number(page)              : undefined,
    limit:     limit     ? Number(limit)             : undefined,
    isActive:  isActive  ? isActive  === "true"      : undefined,
    isExpired: isExpired ? isExpired === "true"      : undefined,
    search:    search    ? String(search)            : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupons retrieved successfully",
    data: result,
  });
});

const getCouponById = catchAsync(async (req, res) => {
  const id     = Number(req.params.id);
  const result = await couponService.getCouponById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon retrieved successfully",
    data: result,
  });
});

const applyCoupon = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data      = JSON.parse(req.body.data);
  const result    = await couponService.applyCoupon(
    email,
    data.code,
    data.orderAmount
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon applied successfully",
    data: result,
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const id     = Number(req.params.id);
  const data   = JSON.parse(req.body.data);
  const result = await couponService.updateCoupon(id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon updated successfully",
    data: result,
  });
});

const toggleCouponStatus = catchAsync(async (req, res) => {
  const id     = Number(req.params.id);
  const result = await couponService.toggleCouponStatus(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Coupon ${result.isActive ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

const deleteCoupon = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await couponService.deleteCoupon(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon deleted successfully",
    data: null,
  });
});

const getMyCouponHistory = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result    = await couponService.getMyCouponHistory(email);
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
  getCouponById,
  applyCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getMyCouponHistory,
};