import { NextFunction, Request, Response, Router } from "express";
import { ReviewCommentValidation } from "./reviewComment.validation";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";
import { reviewCommentController } from "./reviewComment.controller";
import validateRequest from "../../middlewares/validateRequest";

const router = Router();

router.post(
  "/create-review-comment",
  auth(Role.USER, Role.ADMIN),
  validateRequest(ReviewCommentValidation.createReviewComment),
  reviewCommentController.createReviewComment
);

router.get("/", reviewCommentController.getReviewComments);

router.get("/:id", reviewCommentController.getAReviewComment);

router.patch(
  "/update-review-comment/:id",
  auth(Role.USER, Role.ADMIN),
  validateRequest(ReviewCommentValidation.updateReviewComment),
  reviewCommentController.updateReviewComment
);

router.delete(
  "/delete-review-comment/:id",
  auth(Role.USER, Role.ADMIN),
  reviewCommentController.deleteReviewComment
);

export const reviewCommentRouters = router;
