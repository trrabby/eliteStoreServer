import { Router } from "express";
import auth from "../../middlewares/auth";
import { multerUpload } from "../../../config/multer.config";
import { FlashSaleController } from "./FlashSale.controller";
import { Role } from "@prisma/client";
import validateRequestFormdataOptionalPhoto from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { flashSaleValidation } from "./FlashSale.validation";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

// active flash sale for home page / flash sale page
router.get("/active", FlashSaleController.getActiveFlashSale);

// all public active sales (for listing page)
router.get("/", FlashSaleController.getAllFlashSales);

// single sale by slug
router.get("/:slug", FlashSaleController.getFlashSaleBySlug);

// ─────────────────────────────────────────
// VENDOR + ADMIN
// ─────────────────────────────────────────

// my flash sales — vendor
router.get(
  "/my/sales",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.getMyFlashSales,
);

// create flash sale
router.post(
  "/create",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([{ name: "banner", maxCount: 1 }]),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.createFlashSale),
  FlashSaleController.createFlashSale,
);

// update flash sale (DRAFT only)
router.patch(
  "/update-draft/:publicId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([{ name: "banner", maxCount: 1 }]),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.updateFlashSale),
  FlashSaleController.updateFlashSale,
);

// add products in bulk
router.post(
  "/:publicId/items",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.addItems),
  FlashSaleController.addItems,
);

// update single item
router.patch(
  "/update-item/:itemPublicId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.updateItem),
  FlashSaleController.updateItem,
);

// remove single item
router.delete(
  "/delete-item/:itemPublicId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.removeItem,
);

// remove multiple items
router.delete(
  "/removeBulkItems",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.removebulkItems),
  FlashSaleController.removeItems,
);

// activate — DRAFT → ACTIVE
router.patch(
  "/:publicId/activate",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(flashSaleValidation.activateSale),
  FlashSaleController.activateFlashSale,
);

// cancel
router.patch(
  "/:publicId/cancel",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.cancelFlashSale,
);

// delete — DRAFT only
router.delete(
  "/delete-draft/:publicId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.deleteFlashSale,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/admin/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.getFlashSaleStats,
);

// manually end all expired sales
// trigger via cron or admin button
router.post(
  "/admin/end-expired",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.endExpiredSales,
);

export const flashSaleRouter = router;
