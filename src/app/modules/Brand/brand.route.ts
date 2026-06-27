import { Router } from "express";
import { BrandController } from "./brand.controller";
import { brandValidation } from "./brand.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/featured", BrandController.getFeaturedBrands);

router.get("/slug/:slug", BrandController.getBrandBySlug);

router.get("/", BrandController.getAllBrands);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/brandId/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  BrandController.getBrandById,
);

router.post(
  "/create",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  validateRequestFormdata(brandValidation.createBrand),
  BrandController.createBrand,
);

router.patch(
  "/update/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  validateRequestFormdata(brandValidation.updateBrand),
  BrandController.updateBrand,
);

router.patch(
  "/:id/toggle-featured",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  BrandController.toggleFeatured,
);

router.delete(
  "/delete/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  BrandController.deleteBrand,
);

export const brandRouter = router;
