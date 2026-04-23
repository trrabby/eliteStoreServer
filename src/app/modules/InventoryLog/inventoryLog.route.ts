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

// this route is for monitoring purposes, to quickly identify variants that are low on stock without having to check the inventory logs
router.get(
  "/low-stock",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getLowStockVariants,
);

// this route is for monitoring purposes, to quickly identify variants that are out of stock without having to check the inventory logs
router.get(
  "/out-of-stock",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getOutOfStockVariants,
);

// get variant inventory logs with pagination and date range filtering
router.get(
  "/variant/:variantId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getVariantInventoryLogs,
);

// get all inventory logs with pagination and date range filtering
router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InventoryLogController.getAllInventoryLogs,
);

export const inventoryLogRouter = router;
