import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { paymentValidation } from "./payment.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";
const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

// initiate payment for an order
router.post(
  "/initiate",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(paymentValidation.initiatePayment),
  PaymentController.initiatePayment,
);

// get payment status for an order
router.get(
  "/order/:orderId",
  auth(...allRoles),
  PaymentController.getPaymentByOrderId,
);

// ─────────────────────────────────────────
// SSLCOMMERZ CALLBACKS — no auth, called by gateway
// ─────────────────────────────────────────

router.post("/ssl/success", PaymentController.sslSuccess);
router.post("/ssl/fail", PaymentController.sslFail);
router.post("/ssl/cancel", PaymentController.sslCancel);
router.post("/ssl/ipn", PaymentController.sslIpn);

// ─────────────────────────────────────────
// BKASH CALLBACK — no auth, called by gateway
// ─────────────────────────────────────────

router.get("/bkash/callback", PaymentController.bkashCallback);

// ─────────────────────────────────────────
// NAGAD CALLBACK — no auth, called by gateway
// ─────────────────────────────────────────

router.get("/nagad/callback", PaymentController.nagadCallback);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  PaymentController.getAllPayments,
);

router.post(
  "/refund/:orderId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  PaymentController.initiateRefund,
);

export const paymentRouter = router;
