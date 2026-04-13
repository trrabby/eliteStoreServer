import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { VoteService } from "./vote.service";
import { Request } from "express";

// Create vote
const createVote = catchAsync(async (req, res) => {
  const result = await VoteService.createVote(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Vote created successfully",
    data: result,
  });
});

// Get all votes
const getVotes = catchAsync(async (req, res) => {
  const result = await VoteService.getVotes();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Votes fetched successfully",
    data: result,
  });
});

// Get a vote
const getAVote = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await VoteService.getAVote(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vote fetched successfully",
    data: result,
  });
});

// Update a vote
const updateVote = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await VoteService.updateVote(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vote updated successfully",
    data: result,
  });
});

// Delete a vote
const deleteVote = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await VoteService.deleteVote(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vote deleted successfully",
    data: result,
  });
});

export const voteController = {
  createVote,
  getVotes,
  getAVote,
  updateVote,
  deleteVote,
};
