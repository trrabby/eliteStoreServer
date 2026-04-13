import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ReviewCommentService } from "./reviewComment.services";
import { Request } from "express";

// Create review comment
const createReviewComment = catchAsync(async (req, res) => {
  const result = await ReviewCommentService.createReviewComment(req as Request);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review comment created successfully",
    data: result,
  });
});

// Get all review comments
const getReviewComments = catchAsync(async (req, res) => {
  const result = await ReviewCommentService.getReviewComments();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review comments fetched successfully",
    data: result,
  });
});

// Get a review comment
const getAReviewComment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewCommentService.getAReviewComment(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review comment fetched successfully",
    data: result,
  });
});

// Update review comment
const updateReviewComment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewCommentService.updateReviewComment(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review comment updated successfully",
    data: result,
  });
});

// Delete review comment
const deleteReviewComment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewCommentService.deleteReviewComment(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review comment deleted successfully",
    data: result,
  });
});

export const reviewCommentController = {
  createReviewComment,
  getReviewComments,
  getAReviewComment,
  updateReviewComment,
  deleteReviewComment,
};
