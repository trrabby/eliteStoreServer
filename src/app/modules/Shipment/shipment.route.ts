import { Router } from "express";
import { ShipmentController } from "./shipment.controller";
import { shipmentValidation } from "./shipment.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/track/:trackingNumber", ShipmentController.trackByTrackingNumber);

// ─────────────────────────────────────────
// AUTHENTICATED
// ─────────────────────────────────────────

router.get(
  "/order/:orderId",
  auth(Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ShipmentController.getShipmentByOrderId,
);

// ─────────────────────────────────────────
// ADMIN ONLY — manual shipment
// ─────────────────────────────────────────

router.get(
  "/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ShipmentController.getShipmentStats,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ShipmentController.getAllShipments,
);

router.post(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.createShipment),
  ShipmentController.createShipment,
);

router.patch(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.updateShipment),
  ShipmentController.updateShipment,
);

// ─────────────────────────────────────────
// ADMIN ONLY — bulk status updates
// ─────────────────────────────────────────

router.patch(
  "/bulk/out-for-delivery",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.markOutForDelivery),
  ShipmentController.markOutForDelivery,
);

router.patch(
  "/bulk/delivered",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.markDelivered),
  ShipmentController.markDelivered,
);

// ─────────────────────────────────────────
// ADMIN ONLY — Steadfast
// ─────────────────────────────────────────

router.post(
  "/steadfast/bulk-create",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.steadfastBulkCreate),
  ShipmentController.createSteadfastShipments,
);

router.post(
  "/steadfast/sync-status",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(shipmentValidation.steadfastSyncStatus),
  ShipmentController.syncSteadfastStatuses,
);

router.get(
  "/steadfast/balance",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ShipmentController.getSteadfastAccountBalance,
);

export const shipmentRouter = router;
