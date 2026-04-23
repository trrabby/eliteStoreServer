import { Router } from "express";
import { InventoryLogController } from "./inventoryLog.controller";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";

const router = Router();

// all inventory routes are admin only
// writes happen automatically via other services

router.get(
  "/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getInventoryStats,
);

router.get(
  "/low-stock",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getLowStockVariants,
);

router.get(
  "/out-of-stock",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getOutOfStockVariants,
);

router.get(
  "/variant/:variantId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getVariantInventoryLogs,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getAllInventoryLogs,
);

export const inventoryLogRouter = router;
