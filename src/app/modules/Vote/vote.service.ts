import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import { Vote } from "@prisma/client";

const createVote = async (data: any) => {
  const { reviewId, accountId, upVote, downVote } = data;

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

  const vote = await prisma.vote.create({
    data: { reviewId, accountId, upVote, downVote },
  });

  return vote;
};

const getVotes = async () => {
  const result = await prisma.vote.findMany();
  return result;
};

const getAVote = async (id: string) => {
  const result = await prisma.vote.findUniqueOrThrow({
    where: { id },
  });

  return result;
};

const updateVote = async (id: string, data: Partial<Vote>) => {
  await prisma.vote.findUniqueOrThrow({
    where: { id },
  });

  const result = await prisma.vote.update({
    where: { id },
    data,
  });

  return result;
};

const deleteVote = async (id: string) => {
  await prisma.vote.findUniqueOrThrow({
    where: { id },
  });

  const result = await prisma.vote.delete({
    where: { id },
  });

  return result;
};

export const VoteService = {
  createVote,
  getVotes,
  getAVote,
  updateVote,
  deleteVote,
};
