import { NextFunction, Request, Response } from "express";
import { Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import config from "../../config";
import jwt from "jsonwebtoken";
import { jwtHelpers } from "../../helpers/jwtHalpers";

import AppError from "../errors/AppError";

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // -----------------------------
      // TOKEN EXTRACTION
      // -----------------------------
      // [Object: null prototype] {}
      const token = req.cookies?.accessToken || req.headers?.authorization;

      // console.log({ token });

      // Development-only logs
      if (config.env === "development") {
        console.log("\n========== AUTH MIDDLEWARE ==========");
        console.log("TOKEN EXISTS =>", !!token);
      }

      if (!token) {
        if (config.env === "development") {
          console.error("NO TOKEN PROVIDED");
        }

        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized");
      }

      // -----------------------------
      // VERIFY TOKEN
      // -----------------------------
      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt_secret as Secret,
      );

      // -----------------------------
      // SAFE DEBUG LOGGING
      // -----------------------------
      if (config.env === "development") {
        console.log("JWT SECRET EXISTS =>", !!config.jwt_secret);

        console.log("VERIFIED USER =>", {
          id: verifiedUser?.id,
          email: verifiedUser?.email,
          role: verifiedUser?.role,
        });
      }

      // attach user
      req.user = verifiedUser;

      // -----------------------------
      // ROLE CHECK
      // -----------------------------
      if (roles.length && !roles.includes(verifiedUser.role)) {
        if (config.env === "development") {
          console.error("ROLE NOT ALLOWED");

          console.log("REQUIRED ROLES =>", roles);

          console.log("USER ROLE =>", verifiedUser.role);
        }

        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized");
      }

      if (config.env === "development") {
        console.log("AUTH SUCCESS");
        console.log("=====================================\n");
      }

      next();
    } catch (err: any) {
      console.error("\n========== AUTH ERROR ==========");
      console.error("MESSAGE =>", err?.message);

      if (err?.name) {
        console.error("ERROR NAME =>", err.name);
      }

      if (err?.expiredAt) {
        console.error("TOKEN EXPIRED AT =>", err.expiredAt);
      }

      console.error("================================\n");

      // -----------------------------
      // JWT EXPIRED → FORCE 401
      // -----------------------------
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          code: "TOKEN_EXPIRED",
          message: "Token expired",
        });
        return;
      }

      // -----------------------------
      // INVALID TOKEN
      // -----------------------------
      if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          code: "INVALID_TOKEN",
          message: "Invalid token",
        });
        return;
      }

      next(err);
    }
  };
};

export default auth;
