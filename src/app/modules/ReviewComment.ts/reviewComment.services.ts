import httpStatus from "http-status";
import { Request } from "express";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { ReviewComment } from "@prisma/client";

const createReviewComment = async (req: Request) => {
  const { reviewId, accountId } = req.body;

  const isReviewExist = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!isReviewExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  const isAccountExist = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!isAccountExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const reviewComment = await prisma.reviewComment.create({
    data: req.body,
  });

  return reviewComment;
};

const getReviewComments = async () => {
  const result = await prisma.reviewComment.findMany({
    where: { isDeleted: false },
  });
  return result;
};

const getAReviewComment = async (id: string) => {
  const result = await prisma.reviewComment.findUniqueOrThrow({
    where: { id },
  });

  return result;
};

const updateReviewComment = async (
  id: string,
  data: Partial<ReviewComment>
) => {
  await prisma.reviewComment.findUniqueOrThrow({
    where: { id },
  });

  const result = await prisma.reviewComment.update({
    where: { id },
    data,
  });

  return result;
};

const deleteReviewComment = async (id: string) => {
  await prisma.reviewComment.findUniqueOrThrow({ where: { id } });

  const result = await prisma.reviewComment.update({
    where: { id, isDeleted: false },
    data: { isDeleted: true },
  });

  return result;
};

export const ReviewCommentService = {
  createReviewComment,
  getReviewComments,
  getAReviewComment,
  updateReviewComment,
  deleteReviewComment,
};
