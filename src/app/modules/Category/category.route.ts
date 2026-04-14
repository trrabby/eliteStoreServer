import { Router } from "express";
import { CategoryController } from "./category.controller";
import { categoryValidation } from "./category.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

// full nested tree — for frontend nav/sidebar
router.get("/tree", CategoryController.getCategoryTree);

// single by slug — for category page
router.get("/:slug", CategoryController.getCategoryBySlug);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

// flat list with filters — for admin dashboard
router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CategoryController.getAllCategoriesFlat,
);

// single by id — for admin edit form
router.get(
  "/categoryId/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CategoryController.getCategoryById,
);

router.post(
  "/create",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  validateRequestFormdata(categoryValidation.createCategory),
  CategoryController.createCategory,
);

router.patch(
  "/update/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  validateRequestFormdata(categoryValidation.updateCategory),
  CategoryController.updateCategory,
);

router.delete(
  "/delete/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CategoryController.deleteCategory,
);

export const categoryRouter = router;
