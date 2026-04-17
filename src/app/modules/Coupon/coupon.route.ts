import { Router } from "express";
import { CouponController } from "./coupon.controller";
import { couponValidation } from "./coupon.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdata";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "../../../generated/prisma";

const router = Router();

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

// apply coupon — called at checkout before order creation
router.post(
  "/apply",
  auth(Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(couponValidation.applyCoupon),
  CouponController.applyCoupon
);

// my coupon usage history
router.get(
  "/my-history",
  auth(Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.getMyCouponHistory
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.getAllCoupons
);

router.get(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.getCouponById
);

router.post(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(couponValidation.createCoupon),
  CouponController.createCoupon
);

router.patch(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(couponValidation.updateCoupon),
  CouponController.updateCoupon
);

router.patch(
  "/:id/toggle-status",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.toggleCouponStatus
);

router.delete(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.deleteCoupon
);

export const couponRouter = router;