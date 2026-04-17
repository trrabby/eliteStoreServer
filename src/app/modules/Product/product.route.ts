import { Router } from "express";
import { ProductController } from "./product.controller";
import { productValidation } from "./product.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

router.get("/", ProductController.getAllProducts);

router.get("/slug/:slug", ProductController.getProductBySlug);

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
  validateRequestFormdata(productValidation.createProduct),
  ProductController.createProduct,
);

router.patch(
  "/update/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(productValidation.updateProduct),
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
  "/:id/images/:imageId",
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
  validateRequestFormdata(productValidation.createVariant),
  ProductController.createVariant,
);

router.patch(
  "/:id/variants/:variantId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(productValidation.updateVariant),
  ProductController.updateVariant,
);

router.patch(
  "/:id/variants/:variantId/stock",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(productValidation.updateStock),
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
  validateRequestFormdata(productValidation.addAttribute),
  ProductController.addAttribute,
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
  validateRequestFormdata(productValidation.addRelatedProducts),
  ProductController.addRelatedProducts,
);

router.delete(
  "/:id/related/:relatedId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.removeRelatedProduct,
);

export const productRouter = router;
