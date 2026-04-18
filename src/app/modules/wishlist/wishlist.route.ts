import { Router } from "express";
import { WishlistController } from "./wishlist.controller";
import { wishlistValidation } from "./wishlist.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// get wishlist
router.get("/", auth(...allRoles), WishlistController.getWishlist);

// check if product is wishlisted
router.get(
  "/check/:productId",
  auth(...allRoles),
  WishlistController.checkWishlisted,
);

// add to wishlist
router.post(
  "/addToWishlist",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(wishlistValidation.addToWishlist),
  WishlistController.addToWishlist,
);

// toggle — single endpoint for wishlist button on frontend
router.post(
  "/toggle",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(wishlistValidation.addToWishlist),
  WishlistController.toggleWishlist,
);

// move to cart
router.post(
  "/:productId/move-to-cart",
  auth(...allRoles),
  WishlistController.moveToCart,
);

// remove single item
router.delete(
  "/:productId",
  auth(...allRoles),
  WishlistController.removeFromWishlist,
);

// clear entire wishlist
router.delete("/", auth(...allRoles), WishlistController.clearWishlist);

export const wishlistRouter = router;
