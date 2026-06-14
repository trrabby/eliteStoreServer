import { Router } from "express";
import { OrderController } from "./order.controller";
import { orderValidation } from "./order.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

// place order from cart
router.post(
  "/createOrder",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(orderValidation.createOrder),
  OrderController.createOrder,
);

// my orders list
router.get("/my-orders", auth(...allRoles), OrderController.getMyOrders);

// my order by id
router.get("/my-orders/:id", auth(...allRoles), OrderController.getMyOrderById);

// my order by order number — for tracking page
router.get(
  "/my-orders/track/:orderNumber",
  auth(...allRoles),
  OrderController.getMyOrderByNumber,
);

// cancel order — customer/vendor
router.patch(
  "/my-orders/:id/cancel",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(orderValidation.cancelOrder),
  OrderController.cancelOrder,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

// stats for dashboard
router.get(
  "/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getOrderStats,
);

// all orders
router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getAllOrders,
);

// Admin | Vendor

// single order
router.get(
  "/:id",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getOrderById,
);

// update status
router.patch(
  "/single/:id/status",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(orderValidation.updateOrderStatus),
  OrderController.updateOrderStatus,
);

// update status in bulk
router.patch(
  "/bulk/status",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  validateRequestFormdata(orderValidation.updateOrderStatusBulk),
  OrderController.updateOrderStatusBulk,
);

// vendor
router.get(
  "/vendor-orders/:vendorId",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getVendorOrders,
);

router.get(
  "/vendor/my-orders",
  auth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getMyVendorOrders,
);
export const orderRouter = router;
