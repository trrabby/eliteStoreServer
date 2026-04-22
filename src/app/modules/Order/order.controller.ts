import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { orderService } from "./order.service";

const createOrder = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await orderService.createOrder(email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

const getAllOrders = catchAsync(async (req, res) => {
  const { page, limit, status, userId, search, dateFrom, dateTo } = req.query;

  const result = await orderService.getAllOrders({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    userId: userId ? Number(userId) : undefined,
    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, status } = req.query;

  const result = await orderService.getMyOrders(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const getMyOrderById = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const orderId = Number(req.params.id);
  const result = await orderService.getMyOrderById(email, orderId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

const getMyOrderByNumber = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { orderNumber } = req.params;
  const result = await orderService.getMyOrderByNumber(email, orderNumber);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

const getOrderByIdAdmin = catchAsync(async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await orderService.getOrderByIdAdmin(orderId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

const cancelOrder = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const orderId = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  await orderService.cancelOrder(email, orderId, data.cancelReason);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order cancelled successfully",
    data: null,
  });
});

const updateOrderStatus = catchAsync(async (req, res) => {
  const orderId = Number(req.params.id);
  const data = JSON.parse(req.body.data);
  const result = await orderService.updateOrderStatus(orderId, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

const updateOrderStatusBulk = catchAsync(async (req, res) => {
  const data = JSON.parse(req.body.data);

  const result = await orderService.updateOrderStatusBulk(data);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Bulk order status update completed",
    data: result,
  });
});

const getOrderStats = catchAsync(async (req, res) => {
  const result = await orderService.getOrderStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order stats retrieved successfully",
    data: result,
  });
});

export const OrderController = {
  createOrder,
  getAllOrders,
  getMyOrders,
  getMyOrderById,
  getMyOrderByNumber,
  getOrderByIdAdmin,
  cancelOrder,
  updateOrderStatus,
  updateOrderStatusBulk,
  getOrderStats,
};
