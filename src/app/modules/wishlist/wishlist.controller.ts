import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { wishlistService } from "./wishlist.service";

const getWishlist = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await wishlistService.getWishlist(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wishlist retrieved successfully",
    data: result,
  });
});

const addToWishlist = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await wishlistService.addToWishlist(email, data.productId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product added to wishlist",
    data: result,
  });
});

const removeFromWishlist = catchAsync(async (req, res) => {
  const { email }   = req.user as { email: string };
  const productId   = Number(req.params.productId);
  await wishlistService.removeFromWishlist(email, productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product removed from wishlist",
    data: null,
  });
});

const toggleWishlist = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data      = JSON.parse(req.body.data);
  const result    = await wishlistService.toggleWishlist(email, data.productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { wishlisted: result.wishlisted },
  });
});

const checkWishlisted = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const productId = Number(req.params.productId);
  const result    = await wishlistService.checkWishlisted(email, productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wishlist status retrieved",
    data: result,
  });
});

const moveToCart = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const productId = Number(req.params.productId);
  await wishlistService.moveToCart(email, productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product moved to cart",
    data: null,
  });
});

const clearWishlist = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  await wishlistService.clearWishlist(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wishlist cleared",
    data: null,
  });
});

export const WishlistController = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  checkWishlisted,
  moveToCart,
  clearWishlist,
};