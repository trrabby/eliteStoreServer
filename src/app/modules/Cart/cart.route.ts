import { Router } from "express";
import { CartController } from "./cart.controller";
import { cartValidation } from "./cart.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdata";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "../../../generated/prisma";

const router = Router();

// all cart routes require authentication
const allRoles = [
  Role.CUSTOMER,
  Role.VENDOR,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

// get cart
router.get(
  "/",
  auth(...allRoles),
  CartController.getCart
);

// validate cart before checkout
router.get(
  "/validate",
  auth(...allRoles),
  CartController.validateCart
);

// add item
router.post(
  "/items",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(cartValidation.addToCart),
  CartController.addToCart
);

// update item quantity
router.patch(
  "/items/:variantId",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(cartValidation.updateCartItem),
  CartController.updateCartItem
);

// remove single item
router.delete(
  "/items/:variantId",
  auth(...allRoles),
  CartController.removeCartItem
);

// clear entire cart
router.delete(
  "/",
  auth(...allRoles),
  CartController.clearCart
);

export const cartRouter = router;