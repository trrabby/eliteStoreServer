import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { notificationValidation } from "./notification.validation";
import auth from "../../middlewares/auth";
import validateRequestFormdata from "../../middlewares/validateRequestFormdataOptionalPhoto";
import { multerUpload } from "../../../config/multer.config";
import { Role } from "@prisma/client";

const router = Router();

const allRoles = [Role.CUSTOMER, Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────
// PUBLIC — VAPID key for frontend subscription
// ─────────────────────────────────────────

router.get("/vapid-key", NotificationController.getVapidPublicKey);

// ─────────────────────────────────────────
// AUTHENTICATED
// ─────────────────────────────────────────

router.get("/", auth(...allRoles), NotificationController.getMyNotifications);

router.get(
  "/unread-count",
  auth(...allRoles),
  NotificationController.getUnreadCount,
);

router.patch(
  "/mark-all-read",
  auth(...allRoles),
  NotificationController.markAllAsRead,
);

router.patch("/:id/read", auth(...allRoles), NotificationController.markAsRead);

router.delete(
  "/clear-read",
  auth(...allRoles),
  NotificationController.clearReadNotifications,
);

router.delete(
  "/:id",
  auth(...allRoles),
  NotificationController.deleteNotification,
);

// push subscription management
router.post(
  "/push/subscribe",
  auth(...allRoles),
  multerUpload.none(),
  validateRequestFormdata(notificationValidation.savePushSubscription),
  NotificationController.savePushSubscription,
);

router.post(
  "/push/unsubscribe",
  auth(...allRoles),
  multerUpload.none(),
  NotificationController.removePushSubscription,
);

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────

router.get(
  "/stats",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  NotificationController.getNotificationStats,
);

router.post(
  "/bulk",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.none(),
  NotificationController.sendBulkNotification,
);

export const notificationRouter = router;
