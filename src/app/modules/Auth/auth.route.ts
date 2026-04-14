import { Router } from "express";
import { AuthValidation } from "./auth.validation";
import validateRequest from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";
import { AuthController } from "./auth.controller";

const router = Router();

router.post(
  "/login",
  validateRequest(AuthValidation.loginUser),
  AuthController.loginUser,
);

router.post("/login-through-google", AuthController.loginOrRegisterViaGoogle);
router.post("/login-through-github", AuthController.loginOrRegisterViaGithub);

router.get(
  "/me",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  AuthController.getMyProfile,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/change-password",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  validateRequest(AuthValidation.changePassword),
  AuthController.changePassword,
);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPassword),
  AuthController.forgetPassword,
);

router.post(
  "/reset-pass",
  validateRequest(AuthValidation.resetPassword),
  AuthController.resetPassword,
);

router.post(
  "/logout",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER, Role.VENDOR),
  AuthController.logout,
);

export const authRouter = router;
