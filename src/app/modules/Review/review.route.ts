import { Router } from "express";
import { ReviewController } from "./review.controller";
import { reviewValidation } from "./review.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/product/:productId", ReviewController.getProductReviews);

router.get("/:id", ReviewController.getReviewById);

// ─────────────────────────────────────────
// AUTHENTICATED
// ─────────────────────────────────────────

router.post(
  "/create",
  auth(...allRoles),
  multerUpload.array("images", 5),
  validateRequestFormdata(reviewValidation.createReview),
  ReviewController.createReview,
);

router.get(
  "/vendor/:vendorId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ReviewController.getAllReviewsByVendor,
);

router.get("/my/reviews", auth(...allRoles), ReviewController.getMyReviews);

router.patch(
  "/:id",
  auth(...allRoles),
  multerUpload.array("images", 5),
  validateRequestFormdata(reviewValidation.updateReview),
  ReviewController.updateReview,
);

router.delete("/:id", auth(...allRoles), ReviewController.deleteReview);

router.post(
  "/:id/vote",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(reviewValidation.voteReview),
  ReviewController.voteReview,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/stats/overview",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ReviewController.getReviewStats,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ReviewController.getAllReviews,
);

router.patch(
  "/:id/moderate",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(reviewValidation.moderateReview),
  ReviewController.moderateReview,
);

export const reviewRouter = router;
