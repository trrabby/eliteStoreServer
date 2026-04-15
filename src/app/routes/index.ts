import express from "express";
import { authRouter } from "../modules/Auth/auth.route";
import { UserRoutes } from "../modules/User/user.route";
import { vendorProfileRouter } from "../modules/VendorProfile/vendorProfile.route";
import { categoryRouter } from "../modules/Category/category.route";
import { brandRouter } from "../modules/Brand/brand.route";

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
