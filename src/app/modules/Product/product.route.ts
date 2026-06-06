import { Router } from "express";
import { ProductController } from "./product.controller";
import { productValidation } from "./product.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdataOptionalPhoto from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";
import validateRequestFormdataMustPhotoArray from "../../middlewares/validateRequestFormdataMustPhotoArray";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/", ProductController.getAllProducts);

router.get("/slug/:slug", ProductController.getProductBySlug);

router.get("/id/:id", ProductController.getProductByIdPublic);

// ─────────────────────────────────────────
// VENDOR / ADMIN
// ─────────────────────────────────────────

router.get(
  "/my-products",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.getMyProducts,
);

router.get(
  "/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.getProductById,
);

router.post(
  "/create",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.createProduct),
  ProductController.createProduct,
);

router.patch(
  "/update/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.updateProduct),
  ProductController.updateProduct,
);

router.delete(
  "/delete/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.deleteProduct,
);

// ─────────────────────────────────────────
// IMAGES
// ─────────────────────────────────────────

router.post(
  "/addProductImages/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.array("images", 10),
  ProductController.addProductImages,
);

router.patch(
  "/update/:id/images/:imageId/set-primary",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.setPrimaryImage,
);

router.delete(
  "/delete/:id/images/:imageId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.deleteProductImage,
);

// ─────────────────────────────────────────
// VARIANTS
// ─────────────────────────────────────────

router.post(
  "/:id/variants",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.createVariant),
  ProductController.createVariant,
);

router.get(
  "/:id/variants",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.getProductVariants,
);

router.patch(
  "/:id/variants/:variantId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.updateVariant),
  ProductController.updateVariant,
);

router.patch(
  "/:id/variants/:variantId/stock",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.updateStock),
  ProductController.updateStock,
);

router.delete(
  "/:id/variants/:variantId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.deleteVariant,
);

// ─────────────────────────────────────────
// ATTRIBUTES
// ─────────────────────────────────────────

router.post(
  "/:id/attributes",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataMustPhotoArray(productValidation.addAttribute),
  ProductController.addAttribute,
);

router.get(
  "/:id/attributes",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.getAttributes,
);

router.delete(
  "/:id/attributes/:attributeId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.deleteAttribute,
);

// ─────────────────────────────────────────
// RELATED PRODUCTS
// ─────────────────────────────────────────

router.post(
  "/:id/related",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdataOptionalPhoto(productValidation.addRelatedProducts),
  ProductController.addRelatedProducts,
);

router.get(
  "/:id/related",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.getRelatedProducts,
);

router.delete(
  "/:id/related/:relatedId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.removeRelatedProduct,
);

export const productRouter = router;
