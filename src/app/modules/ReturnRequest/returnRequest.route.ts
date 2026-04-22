import { Router } from "express";
import { ReturnRequestController } from "./returnRequest.controller";
import { returnRequestValidation } from "./returnRequest.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

// submit return request with optional images
router.post(
  "/create",
  auth(...allRoles),
  multerUpload.array("images", 5),
  validateRequestFormdata(returnRequestValidation.createReturnRequest),
  ReturnRequestController.createReturnRequest,
);

// my return requests
router.get(
  "/my-requests",
  auth(...allRoles),
  ReturnRequestController.getMyReturnRequests,
);

// single return request
router.get(
  "/:id",
  auth(...allRoles),
  ReturnRequestController.getReturnRequestById,
);

// cancel my return request
router.patch(
  "/:id/cancel",
  auth(...allRoles),
  ReturnRequestController.cancelReturnRequest,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

// dashboard stats
router.get(
  "/stats/overview",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ReturnRequestController.getReturnStats,
);

// all return requests
router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ReturnRequestController.getAllReturnRequests,
);

// approve or reject — triggers all cascading updates
router.patch(
  "/:id/process",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(returnRequestValidation.processReturn),
  ReturnRequestController.processReturn,
);

// manual status update
router.patch(
  "/:id/status",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(returnRequestValidation.updateReturnStatus),
  ReturnRequestController.updateReturnStatus,
);

export const returnRequestRouter = router;
