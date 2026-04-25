import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import {
  sendPushNotification,
  PushSubscriptionData,
} from "./notification.push";
import { emitToUser } from "../../../config/socket";

// ─────────────────────────────────────────
// CORE SEND FUNCTION
// used by ALL other modules to send notifications
// ─────────────────────────────────────────

export const sendNotification = async (payload: {
  userId: number;
  type: string;
  title: string;
  body: string;
  link?: string;
}): Promise<void> => {
  // 1. save to DB
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type as any,
      title: payload.title,
      body: payload.body,
      isRead: false,
      link: payload.link ?? null,
    },
  });

  // 2. real-time via socket — if user is online
  emitToUser(payload.userId, "notification:new", {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    isRead: false,
    createdAt: notification.createdAt,
  });

  // 3. also emit updated unread count
  const unreadCount = await prisma.notification.count({
    where: { userId: payload.userId, isRead: false },
  });

  emitToUser(payload.userId, "notification:unreadCount", {
    count: unreadCount,
  });

  // 4. browser push notification — for offline/background users
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: payload.userId },
  });

  for (const sub of subscriptions) {
    const subData: PushSubscriptionData = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    const success = await sendPushNotification(subData, {
      title: payload.title,
      body: payload.body,
      link: payload.link,
      tag: payload.type,
    });

    // remove expired subscription
    if (!success) {
      await prisma.pushSubscription
        .delete({
          where: { id: sub.id },
        })
        .catch(() => {});
    }
  }
};

// ─────────────────────────────────────────
// CONVENIENCE SENDERS — used by other modules
// ─────────────────────────────────────────

export const sendOrderNotification = async (
  userId: number,
  orderNumber: string,
  status: string,
  orderId: number,
) => {
  const messages: Record<string, string> = {
    CONFIRMED: `Your order #${orderNumber} has been confirmed!`,
    PROCESSING: `Your order #${orderNumber} is being processed.`,
    SHIPPED: `Your order #${orderNumber} has been shipped!`,
    OUT_FOR_DELIVERY: `Your order #${orderNumber} is out for delivery!`,
    DELIVERED: `Your order #${orderNumber} has been delivered!`,
    CANCELLED: `Your order #${orderNumber} has been cancelled.`,
    RETURNED: `Return for order #${orderNumber} has been processed.`,
    REFUNDED: `Refund for order #${orderNumber} has been initiated.`,
  };

  await sendNotification({
    userId,
    type: "ORDER_UPDATE",
    title: "Order Update",
    body: messages[status] ?? `Order #${orderNumber} status: ${status}`,
    link: `/orders/${orderId}`,
  });
};

export const sendPaymentNotification = async (
  userId: number,
  amount: number,
  orderNumber: string,
  success: boolean,
) => {
  await sendNotification({
    userId,
    type: "PAYMENT",
    title: success ? "Payment Successful" : "Payment Failed",
    body: success
      ? `Payment of ${amount} BDT for order #${orderNumber} was successful.`
      : `Payment for order #${orderNumber} failed. Please try again.`,
    link: `/orders`,
  });
};

export const sendWalletNotification = async (
  userId: number,
  amount: number,
  type: "CREDIT" | "DEBIT",
  reason: string,
) => {
  await sendNotification({
    userId,
    type: "PAYMENT",
    title: type === "CREDIT" ? "Wallet Credited" : "Wallet Debited",
    body: `${amount} BDT has been ${type === "CREDIT" ? "added to" : "deducted from"} your wallet. ${reason}`,
    link: "/wallet",
  });
};

export const sendReviewNotification = async (
  userId: number,
  productName: string,
) => {
  await sendNotification({
    userId,
    type: "REVIEW",
    title: "Review Your Purchase",
    body: `How was ${productName}? Share your experience!`,
    link: "/reviews",
  });
};

export const sendLowStockNotification = async (
  vendorUserId: number,
  productName: string,
  sku: string,
  stock: number,
) => {
  await sendNotification({
    userId: vendorUserId,
    type: "RESTOCK",
    title: "Low Stock Alert",
    body: `${productName} (SKU: ${sku}) is running low — only ${stock} left.`,
    link: "/vendor/inventory",
  });
};

export const sendPromoNotification = async (
  userIds: number[],
  title: string,
  body: string,
  link?: string,
) => {
  // batch — send to many users
  for (const userId of userIds) {
    await sendNotification({ userId, type: "PROMOTION", title, body, link });
  }
};

// ─────────────────────────────────────────
// READ / MANAGE SERVICES
// ─────────────────────────────────────────

// get my notifications — paginated
const getMyNotifications = async (
  userId: number,
  query: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    type?: string;
  },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  // console.log(userId);
  const where: any = { userId };

  if (query.isRead !== undefined) where.isRead = query.isRead;
  if (query.type) where.type = query.type;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { total, page, limit, unreadCount, notifications };
};

// mark single notification as read
export const markAsRead = async (userId: number, notificationId: number) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  if (notification.isRead) return notification;

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  // emit updated unread count
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  emitToUser(userId, "notification:unreadCount", { count: unreadCount });

  return updated;
};

// mark all as read
export const markAllAsRead = async (userId: number) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  emitToUser(userId, "notification:unreadCount", { count: 0 });
  emitToUser(userId, "notification:allRead", {});

  return "All notifications marked as read";
};

// get unread count
export const getUnreadCount = async (userId: number): Promise<number> => {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
};

// delete single notification
const deleteNotification = async (userId: number, notificationId: number) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  await prisma.notification.delete({ where: { id: notificationId } });
  return "Notification deleted";
};

// clear all read notifications
const clearReadNotifications = async (userId: number) => {
  await prisma.notification.deleteMany({
    where: { userId, isRead: true },
  });
  return "Read notifications cleared";
};

// ─── Push subscription management ────────

const savePushSubscription = async (
  userId: number,
  payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
) => {
  // upsert — same endpoint can be re-registered
  await prisma.pushSubscription.upsert({
    where: { endpoint: payload.endpoint },
    update: {
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
    create: {
      userId,
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
  });

  return "Push subscription saved";
};

const removePushSubscription = async (userId: number, endpoint: string) => {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return "Push subscription removed";
};

// ─── Admin ────────────────────────────────

// send bulk notification — admin
const sendBulkNotification = async (payload: {
  userIds?: number[]; // specific users — if empty sends to all
  type: string;
  title: string;
  body: string;
  link?: string;
}) => {
  let userIds = payload.userIds ?? [];

  if (!userIds.length) {
    // send to all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  // batch in chunks of 100
  const chunkSize = 100;
  let sent = 0;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);

    await prisma.notification.createMany({
      data: chunk.map((userId) => ({
        userId,
        type: payload.type as any,
        title: payload.title,
        body: payload.body,
        isRead: false,
        link: payload.link ?? null,
      })),
    });

    // socket emit to each online user
    for (const userId of chunk) {
      emitToUser(userId, "notification:new", {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      });
    }

    sent += chunk.length;
  }

  return { sent };
};

// get notification stats — admin
const getNotificationStats = async () => {
  const [total, unread, byType] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.groupBy({
      by: ["type"],
      _count: { type: true },
    }),
  ]);

  return { total, unread, read: total - unread, byType };
};

export const notificationService = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  clearReadNotifications,
  savePushSubscription,
  removePushSubscription,
  sendBulkNotification,
  getNotificationStats,
  // convenience senders
  sendNotification,
  sendOrderNotification,
  sendPaymentNotification,
  sendWalletNotification,
  sendReviewNotification,
  sendLowStockNotification,
  sendPromoNotification,
};
