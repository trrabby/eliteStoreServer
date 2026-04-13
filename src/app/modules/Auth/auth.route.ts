import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
import validateRequest from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";

const router = Router();

router.post(
  "/login",
  validateRequest(AuthValidation.loginUser),
  AuthController.loginUser
);
router.post(
  "/register",
  validateRequest(AuthValidation.registerUser),
  AuthController.registerUser
);
router.get(
  "/me",
  auth(Role.ADMIN, Role.COMPANY, Role.USER),
  AuthController.getMyProfile
);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/change-password",
  auth(Role.ADMIN, Role.COMPANY, Role.USER),
  validateRequest(AuthValidation.changePassword),
  AuthController.changePassword
);
router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPassword),
  AuthController.forgetPassword
);

router.post(
  "/reset-pass",
  validateRequest(AuthValidation.resetPassword),
  AuthController.resetPassword
);

export const authRouter = router;
