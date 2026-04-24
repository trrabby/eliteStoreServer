import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";

import { Secret } from "jsonwebtoken";
import { jwtHelpers } from "../helpers/jwtHalpers";
import config from ".";

// online users map — userId → Set of socketIds
// one user can have multiple browser tabs open
const onlineUsers = new Map<number, Set<string>>();

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwtHelpers.verifyToken(
        token,
        config.jwt_secret as Secret,
      );
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    const userId = user?.id ?? user?.sub;

    if (!userId) {
      socket.disconnect();
      return;
    }

    // track online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // join personal room
    socket.join(`user:${userId}`);

    console.log(`User ${userId} connected — socket ${socket.id}`);

    // ── Client events ───────────────────────

    // mark single notification as read
    socket.on("notification:markRead", async (notificationId: number) => {
      try {
        const { markAsRead } =
          await import("../app/modules/Notification/notification.service");
        await markAsRead(userId, notificationId);
        socket.emit("notification:readConfirmed", { notificationId });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // mark all notifications as read
    socket.on("notification:markAllRead", async () => {
      try {
        const { markAllAsRead } =
          await import("../app/modules/Notification/notification.service");
        await markAllAsRead(userId);
        socket.emit("notification:allReadConfirmed");
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // client requests unread count on connect
    socket.on("notification:getUnreadCount", async () => {
      try {
        const { getUnreadCount } =
          await import("../app/modules/Notification/notification.service");
        const count = await getUnreadCount(userId);
        socket.emit("notification:unreadCount", { count });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
      console.log(`User ${userId} disconnected — socket ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

export const isUserOnline = (userId: number): boolean => {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
};

// emit to specific user room
export const emitToUser = (
  userId: number,
  event: string,
  payload: any,
): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
};

// emit to all connected clients
export const emitToAll = (event: string, payload: any): void => {
  if (io) {
    io.emit(event, payload);
  }
};
