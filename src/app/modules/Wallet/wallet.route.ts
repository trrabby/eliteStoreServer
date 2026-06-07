import { Router } from "express";
import { WalletController } from "./wallet.controller";
import { walletValidation } from "./wallet.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

router.get("/", auth(...allRoles), WalletController.getWallet);

router.get(
  "/transactions",
  auth(...allRoles),
  WalletController.getTransactionHistory,
);

router.post(
  "/add-money",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(walletValidation.addMoney),
  WalletController.initiateAddMoney,
);

router.post(
  "/transfer",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(walletValidation.transferToWallet),
  WalletController.transferToWallet,
);

// ─────────────────────────────────────────
// GATEWAY CALLBACKS — no auth
// ─────────────────────────────────────────

router.post("/ssl/success", WalletController.walletSSLSuccess);
router.post("/ssl/fail", WalletController.walletSSLFail);
router.post("/ssl/cancel", WalletController.walletSSLCancel);
router.get("/bkash/callback", WalletController.walletBkashCallback);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  WalletController.getWalletStats,
);

router.get(
  "/all",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  WalletController.getAllWallets,
);

router.post(
  "/admin-credit",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  WalletController.adminCreditWallet,
);

router.get(
  "/transactions/all",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  WalletController.getAllTransactions,
);

export const walletRouter = router;
