import express, { NextFunction, Request, Response } from "express";
import { UserController } from "./user.controller";
import auth from "../../middlewares/auth";
import { userValidation } from "./user.validation";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";
import validateRequestFormdataOptionalPhoto from "../../middlewares/validateRequestFormdataOptionalPhoto";

const router = express.Router();

// Public
router.post(
  "/register",
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(userValidation.registerUser),
  UserController.registerUser,
);

// Admin only
router.get("/", auth(Role.ADMIN, Role.SUPER_ADMIN), UserController.getAllUsers);

router.patch(
  "/make-admin/:publicId",
  auth(Role.SUPER_ADMIN),
  UserController.makeAdmin,
);

// Authenticated users
router.get(
  "/my-profile",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  UserController.getMyProfile,
);

router.get(
  "/by-email/:email",
  // auth(Role.ADMIN, Role.SUPER_ADMIN),
  UserController.getAnAccountByEmail,
);

router.patch(
  "/my-profile",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  multerUpload.single("image"),
  validateRequestFormdataOptionalPhoto(userValidation.updateUser),
  UserController.updateMyProfile,
);

router.patch(
  "/delete-profile/:publicId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  UserController.deleteAProfile,
);

// ─────────────────────────────────────────
// ADDRESS ROUTES
// ─────────────────────────────────────────

router.post(
  "/add-addresses",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(userValidation.addAddress),
  UserController.addAddress,
);

router.get(
  "/addresses",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  UserController.getMyAddresses,
);

router.get(
  "/addresses/:addressId",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  UserController.getSingleAddress,
);

router.patch(
  "/addresses/:addressId",
  multerUpload.none(),
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  validateRequestFormdataOptionalPhoto(userValidation.updateAddress),
  UserController.updateAddress,
);

router.patch(
  "/addresses/:addressId/set-default",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  UserController.setDefaultAddress,
);

router.delete(
  "/addresses/:addressId",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  UserController.deleteAddress,
);
export const UserRoutes = router;
