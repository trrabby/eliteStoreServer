import { NextFunction, Request, Response, Router } from "express";
import auth from "../../middlewares/auth";
import { ProductController } from "./product.controller";
import { productValidation } from "./product.validation";
import validateRequest from "../../middlewares/validateRequest";
import { Role } from "@prisma/client";
import { multerUpload } from "../../../config/multer.config";


const router = Router();

/// create product
router.post(
  "/create-product",
  auth(Role.COMPANY, Role.ADMIN, Role.USER),
  multerUpload.single("image"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = productValidation.createProduct.parse(JSON.parse(req.body.data));
    ProductController.createProduct(req, res, next);
  }
);

// get product
router.get("/", ProductController.getProducts);

// get a product
router.get("/:id", ProductController.getAProduct);

// Update a Product
router.patch(
  "/update-product/:id",
  auth(Role.COMPANY, Role.ADMIN),
  validateRequest(productValidation.updateAProduct),
  ProductController.updateAProduct
);

// delete a Product
router.delete(
  "/delete-product/:id",
  auth(Role.COMPANY, Role.ADMIN),
  ProductController.deleteAProduct
);

export const productRouters = router;
