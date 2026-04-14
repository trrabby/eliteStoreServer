import { Router } from "express";
import { VendorProfileController } from "./vendorProfile.controller";
import { vendorProfileValidation } from "./vendorProfile.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/", VendorProfileController.getAllVendors);

router.get("/:slug", VendorProfileController.getVendorBySlug);

// ─────────────────────────────────────────
// VENDOR / AUTHENTICATED
// ─────────────────────────────────────────

router.get(
  "/my/profile",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  VendorProfileController.getMyVendorProfile,
);

router.post(
  "/create-vendor",
  auth(Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  validateRequestFormdata(vendorProfileValidation.createVendorProfile),
  VendorProfileController.createVendorProfile,
);

router.patch(
  "/my/profile",
  auth(Role.VENDOR),
  multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  validateRequestFormdata(vendorProfileValidation.updateVendorProfile),
  VendorProfileController.updateVendorProfile,
);

router.delete(
  "/my/profile",
  auth(Role.VENDOR),
  VendorProfileController.deleteVendorProfile,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.patch(
  "/:publicId/verify",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  VendorProfileController.verifyVendor,
);

router.patch(
  "/:publicId/deactivate",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  VendorProfileController.deactivateVendor,
);

export const vendorProfileRouter = router;
