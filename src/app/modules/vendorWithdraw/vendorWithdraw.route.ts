import { Router } from "express";
import { VendorWithdrawController } from "./vendorWithdraw.controller";
import { vendorWithdrawValidation } from "./vendorWithdraw.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─── Vendor ────────────────────────────────────────────────────
// Create withdraw request
router.post(
  "/",
  auth(Role.VENDOR),
  multerUpload.none(),
  validateRequestFormdata(vendorWithdrawValidation.createWithdrawRequest),
  VendorWithdrawController.createWithdrawRequest,
);

// Get my requests
router.get(
  "/my/requests",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  VendorWithdrawController.getMyWithdrawRequests,
);

// Cancel own pending request
router.patch(
  "/my/cancel/:publicId",
  auth(Role.VENDOR),
  VendorWithdrawController.cancelWithdrawRequest,
);

// ─── Admin | Vendor ─────────────────────────────────────────────────────

// Get single requests
router.get(
  "/my/request/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  VendorWithdrawController.getSingleWithdrawRequest,
);

// ─── Admin ─────────────────────────────────────────────────────
// Get all requests
router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  VendorWithdrawController.getAllWithdrawRequests,
);

// Get single request
router.get(
  "/:publicId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  VendorWithdrawController.getWithdrawRequestById,
);

// Update status (PROCESSING / PAID / CANCELLED)
router.patch(
  "/:publicId/status",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(vendorWithdrawValidation.updateWithdrawStatus),
  VendorWithdrawController.updateWithdrawStatus,
);

export const vendorWithdrawRouter = router;
