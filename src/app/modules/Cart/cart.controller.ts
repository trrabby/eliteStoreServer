import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { cartService } from "./cart.services";

const getCart = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await cartService.getCart(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart retrieved successfully",
    data: result,
  });
});

const addToCart = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  console.log(email, JSON.parse(req.body.data));
  const data = JSON.parse(req.body.data);
  const result = await cartService.addToCart(email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Item added to cart",
    data: result,
  });
});

const updateCartItem = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const variantId = Number(req.params.variantId);
  const data = JSON.parse(req.body.data);
  const result = await cartService.updateCartItem(
    email,
    variantId,
    data.quantity,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart item updated",
    data: result,
  });
});

const removeCartItem = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const variantId = Number(req.params.variantId);
  await cartService.removeCartItem(email, variantId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Item removed from cart",
    data: null,
  });
});

const clearCart = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  await cartService.clearCart(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart cleared",
    data: null,
  });
});

const validateCart = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await cartService.validateCart(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isValid
      ? "Cart is valid and ready for checkout"
      : "Cart has issues that need to be resolved",
    data: result,
  });
});

export const CartController = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
};
