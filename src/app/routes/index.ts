import express from "express";
import { authRouter } from "../modules/Auth/auth.route";
import { UserRoutes } from "../modules/User/user.route";
import { vendorProfileRouter } from "../modules/VendorProfile/vendorProfile.route";
import { categoryRouter } from "../modules/Category/category.route";
import { brandRouter } from "../modules/Brand/brand.route";
import { productRouter } from "../modules/Product/product.route";
import { cartRouter } from "../modules/Cart/cart.route";
import { wishlistRouter } from "../modules/wishlist/wishlist.route";
import { couponRouter } from "../modules/Coupon/coupon.route";
import { orderRouter } from "../modules/Order/order.route";
import { paymentRouter } from "../modules/Payment/payment.route";
import { shipmentRouter } from "../modules/Shipment/shipment.route";
import { returnRequestRouter } from "../modules/ReturnRequest/returnRequest.route";
import { reviewRouter } from "../modules/Review/review.route";
import { inventoryLogRouter } from "../modules/InventoryLog/inventoryLog.route";
import { walletRouter } from "../modules/Wallet/wallet.route";
import { notificationRouter } from "../modules/Notification/notification.route";
import { flashSaleRouter } from "../modules/FlashSale/FlashSale.route";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: authRouter,
  },
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/vendors",
    route: vendorProfileRouter,
  },
  {
    path: "/categories",
    route: categoryRouter,
  },
  {
    path: "/brands",
    route: brandRouter,
  },
  {
    path: "/products",
    route: productRouter,
  },
  {
    path: "/cart",
    route: cartRouter,
  },
  {
    path: "/wishlist",
    route: wishlistRouter,
  },
  {
    path: "/coupons",
    route: couponRouter,
  },
  {
    path: "/flash-sales",
    route: flashSaleRouter,
  },
  {
    path: "/orders",
    route: orderRouter,
  },
  {
    path: "/payments",
    route: paymentRouter,
  },
  {
    path: "/shipments",
    route: shipmentRouter,
  },
  {
    path: "/return-requests",
    route: returnRequestRouter,
  },
  {
    path: "/reviews",
    route: reviewRouter,
  },
  {
    path: "/inventory-logs",
    route: inventoryLogRouter,
  },
  {
    path: "/wallet",
    route: walletRouter,
  },
  {
    path: "/notifications",
    route: notificationRouter,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
