import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { reviewService } from "./review.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

const createReview = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const files = req.files as Express.Multer.File[] | undefined;

  const data = JSON.parse(req.body.data);

  let images: string[] = [];

  if (files?.length) {
    const uploaded = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, "reviews")),
    );

    images = uploaded.map((img: any) => img.secure_url);
  }
  console.log(images);
  const result = await reviewService.createReview(email, data, images);

  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const getProductReviews = catchAsync(async (req, res) => {
  const productId = Number(req.params.productId);
  const { page, limit, rating, sortBy } = req.query;
  const result = await reviewService.getProductReviews(productId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    rating: rating ? Number(rating) : undefined,
    sortBy: sortBy ? String(sortBy) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req, res) => {
  const { page, limit, status, productId, rating, search } = req.query;
  const result = await reviewService.getAllReviews({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    productId: productId ? Number(productId) : undefined,
    rating: rating ? Number(rating) : undefined,
    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    data: result,
  });
});

const getMyReviews = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit } = req.query;
  const result = await reviewService.getMyReviews(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    data: result,
  });
});

const getReviewById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await reviewService.getReviewById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review retrieved successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { email } = req.user as { email: string };
  const files = req.files as Express.Multer.File[] | undefined;
  let images: string[] = [];

  if (files?.length) {
    const uploaded = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, "reviews")),
    );

    images = uploaded.map((img: any) => img.secure_url);
  }
  // console.log(images);
  const data = JSON.parse(req.body.data);
  const result = await reviewService.updateReview(id, email, data, images);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { email } = req.user as { email: string };
  await reviewService.deleteReview(id, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review deleted successfully",
    data: null,
  });
});

const moderateReview = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await reviewService.moderateReview(id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review moderated successfully",
    data: result,
  });
});

const voteReview = catchAsync(async (req, res) => {
  const reviewId = Number(req.params.id);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  await reviewService.voteReview(reviewId, email, data.isHelpful);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vote recorded",
    data: null,
  });
});

const getReviewStats = catchAsync(async (req, res) => {
  const result = await reviewService.getReviewStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review stats retrieved successfully",
    data: result,
  });
});

export const ReviewController = {
  createReview,
  getProductReviews,
  getAllReviews,
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
  moderateReview,
  voteReview,
  getReviewStats,
};
