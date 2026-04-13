import { NextFunction, Request, Response, Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { Role } from "@prisma/client";
import { reviewController } from "./review.controller";
import { reviewValidation } from "./review.validation";
import { fileUploader } from "../../../helpers/fileUploader";

const router = Router();

/// create review
router.post(
  "/create-review",
  auth(Role.USER, Role.COMPANY, Role.ADMIN),
  fileUploader.upload.single("image"),
  validateRequest(reviewValidation.createReviewSchema),
  reviewController.createReview
);

// get all review
router.get("/", reviewController.getReview);

// get single review
router.get(
  "/:id",
  auth(Role.USER, Role.COMPANY, Role.ADMIN),
  reviewController.getAReview
);

/// update review
router.patch(
  "/update-review/:id",
  auth(Role.COMPANY, Role.ADMIN),
  validateRequest(reviewValidation.updateReviewSchema),
  reviewController.updateAReview
);

router.delete(
  "/delete-review/:id",
  auth(Role.COMPANY, Role.ADMIN),
  reviewController.deleteAReview
);

// init-payment
router.post(
  "/:id/init-payment",
  auth(Role.USER, Role.ADMIN, Role.COMPANY),
  reviewController.initPremiumPayment
);

// validate payment
router.post("/validate-payment", reviewController.validatePremiumPayment);

export const reviewRouters = router;
