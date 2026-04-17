import express from "express";
import { authRouter } from "../modules/Auth/auth.route";
import { UserRoutes } from "../modules/User/user.route";
import { vendorProfileRouter } from "../modules/VendorProfile/vendorProfile.route";
import { categoryRouter } from "../modules/Category/category.route";
import { brandRouter } from "../modules/Brand/brand.route";
import { productRouter } from "../modules/Product/product.route";
import { cartRouter } from "../modules/Cart/cart.route";

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
