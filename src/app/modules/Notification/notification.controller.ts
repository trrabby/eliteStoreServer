import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { notificationService } from "./notification.service";
import config from "../../../config";

const getMyNotifications = catchAsync(async (req, res) => {
  const user = req.user as { id: string; email: string; role: string };
  const { page, limit, isRead, type } = req.query;

  const result = await notificationService.getMyNotifications(Number(user.id), {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    isRead: isRead ? isRead === "true" : undefined,
    type: type ? String(type) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const notificationId = Number(req.params.id);
  const result = await notificationService.markAsRead(
    Number(user.id),
    notificationId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const result = await notificationService.markAllAsRead(Number(user.id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const count = await notificationService.getUnreadCount(Number(user.id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved",
    data: { count },
  });
});

const deleteNotification = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const notificationId = Number(req.params.id);
  await notificationService.deleteNotification(Number(user.id), notificationId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted",
    data: null,
  });
});

const clearReadNotifications = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  await notificationService.clearReadNotifications(Number(user.id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Read notifications cleared",
    data: null,
  });
});

// push subscription
const savePushSubscription = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const data = JSON.parse(req.body.data);
  await notificationService.savePushSubscription(Number(user.id), data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Push subscription saved",
    data: null,
  });
});

const removePushSubscription = catchAsync(async (req, res) => {
  const user = req.user as { id: string };
  const data = JSON.parse(req.body.data);
  await notificationService.removePushSubscription(
    Number(user.id),
    data.endpoint,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Push subscription removed",
    data: null,
  });
});

// get VAPID public key — frontend needs this to subscribe
const getVapidPublicKey = catchAsync(async (req, res) => {
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "VAPID public key",
    data: { publicKey: config.vapid.publicKey },
  });
});

// admin
const sendBulkNotification = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);
  const result = await notificationService.sendBulkNotification(data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Notification sent to ${result.sent} users`,
    data: result,
  });
});

const getNotificationStats = catchAsync(async (req, res) => {
  const result = await notificationService.getNotificationStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification stats retrieved",
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  clearReadNotifications,
  savePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  sendBulkNotification,
  getNotificationStats,
};
