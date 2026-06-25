import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { notificationService } from "./notification.service";
import config from "../../../config";
import { userService } from "../User/user.service";

const getMyNotifications = catchAsync(async (req, res) => {
  const user = req.user as { email: string; role: string };
  // find userId from publicId of User
  const userAccount = await userService.getUserDetails(user.email);

  const { page, limit, isRead, type } = req.query;
  const result = await notificationService.getMyNotifications(userAccount.id, {
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
  const user = req.user as { email: string };
  // find userId from publicId of User
  const userAccount = await userService.getUserDetails(user.email);
  const notificationId = Number(req.params.id);
  const result = await notificationService.markAsRead(
    userAccount.id,
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
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  const result = await notificationService.markAllAsRead(userAccount.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  const count = await notificationService.getUnreadCount(userAccount.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved",
    data: { count },
  });
});

const deleteNotification = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  const notificationId = Number(req.params.id);
  await notificationService.deleteNotification(userAccount.id, notificationId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted",
    data: null,
  });
});

const clearReadNotifications = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  await notificationService.clearReadNotifications(userAccount.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Read notifications cleared",
    data: null,
  });
});

// push subscription
const savePushSubscription = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  const data = JSON.parse(req.body.data);
  await notificationService.savePushSubscription(userAccount.id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Push subscription saved",
    data: null,
  });
});

const removePushSubscription = catchAsync(async (req, res) => {
  const user = req.user as { email: string };
  const userAccount = await userService.getUserDetails(user.email);
  const data = JSON.parse(req.body.data);
  await notificationService.removePushSubscription(
    userAccount.id,
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
