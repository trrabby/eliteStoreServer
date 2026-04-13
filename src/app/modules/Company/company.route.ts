import { NextFunction, Request, Response, Router } from "express";
import { CompanyValidation } from "./company.validation";
import { Role } from "@prisma/client";
import auth from "../../middlewares/auth";
import { companyController } from "./company.controller";
import validateRequest from "../../middlewares/validateRequest";
import { fileUploader } from "../../../helpers/fileUploader";

const router = Router();

/// create Company
router.post(
  "/create-company",
  auth(Role.ADMIN, Role.USER),
  fileUploader.upload.single("image"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = CompanyValidation.createCompany.parse(JSON.parse(req.body.data));
    companyController.createCompany(req, res, next);
  }
);

// get Company
router.get("/", companyController.getCompany);

// get a Company
router.get("/:id", companyController.getACompany);

// Update a Company
router.patch(
  "/update-company/:id",
  auth(Role.COMPANY, Role.ADMIN),
  validateRequest(CompanyValidation.updateCompany),
  companyController.updateACompany
);

// delete a Company
router.delete(
  "/delete-company/:id",
  auth(Role.COMPANY, Role.ADMIN),
  companyController.deleteACompany
);

export const companyRouters = router;
