import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { JwtPayload, Secret } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import prisma from "../../../shared/prisma";
import { jwtHelpers } from "../../../helpers/jwtHalpers";
import config from "../../../config";
import emailSender from "../../../shared/emailSender";
import { Role } from "@prisma/client";

// Login user
const loginUser = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email, isActive: true, isBanned: false },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  if (!user.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please login with your OAuth provider",
    );
  }

  const isPasswordMatch = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid password");
  }

  // update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = jwtHelpers.generateToken(
    { email: user.email, role: user.role, publicId: user.publicId },
    config.jwt_secret as Secret,
    config.expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    { email: user.email, role: user.role, publicId: user.publicId },
    config.refresh_token_secret as Secret,
    config.refresh_token_expires_in as string,
  );

  return { accessToken, refreshToken };
};

// Register or Login via OAuth provider (upsert flow)
const loginOrRegisterViaProvider = async (payload: {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  provider: string; // "google" | "github"
}) => {
  // check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  // if not exists — create user + accountInfo + oauthAccount in one transaction
  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: payload.email,
          password: null,
          role: Role.CUSTOMER,
          isEmailVerified: true,
        },
      });

      await tx.accountInfo.create({
        data: {
          user: { connect: { id: newUser.id } }, // explicit connect
          firstName: payload.firstName || payload.email.split("@")[0], // fallback to email prefix
          lastName: payload.lastName || "-", // fallback to "-" since required
          avatar: payload.avatar ?? null,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          user: { connect: { id: newUser.id } },
          provider: payload.provider,
          providerUid: payload.email,
        },
      });

      return newUser;
    });
  }

  // either way — check account is usable
  if (!user.isActive) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This account has been deactivated",
    );
  }

  if (user.isBanned) {
    throw new AppError(httpStatus.FORBIDDEN, "This account has been banned");
  }

  // update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const jwtPayload = {
    email: user.email,
    role: user.role,
    publicId: user.publicId,
  };

  const accessToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt_secret as Secret,
    config.expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    jwtPayload,
    config.refresh_token_secret as Secret,
    config.refresh_token_expires_in as string,
  );

  return {
    isNewUser: !user, // tells controller whether it was a register or login
    accessToken,
    refreshToken,
  };
};

// Get my profile
const getMyProfile = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true, isBanned: false },
    include: {
      accountInfo: true,
      addresses: { where: { isDefault: true } },
      vendorProfile: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// Refresh token
const refreshToken = async (token: string) => {
  let decodedData: JwtPayload;
  try {
    decodedData = jwtHelpers.verifyToken(
      token,
      config.refresh_token_secret as Secret,
    );
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const user = await prisma.user.findUnique({
    where: { email: decodedData.email, isActive: true, isBanned: false },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const accessToken = jwtHelpers.generateToken(
    { email: user.email, role: user.role, publicId: user.publicId },
    config.jwt_secret as Secret,
    config.expires_in as string,
  );

  return accessToken;
};

// Change password
const changePassword = async (
  user: JwtPayload,
  payload: { oldPassword: string; newPassword: string },
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: user.email, isActive: true, isBanned: false },
  });

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!existingUser.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for OAuth accounts",
    );
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.oldPassword,
    existingUser.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

  await prisma.user.update({
    where: { email: existingUser.email },
    data: { password: hashedPassword },
  });

  return "Password updated successfully.";
};

// Forget password
const forgetPassword = async (payload: { email: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const resetToken = jwtHelpers.generateToken(
    { email: user.email, role: user.role },
    config.reset_pass_token as Secret,
    config.reset_pass_token_expires_in as string,
  );

  const resetPassLink = `${config.reset_pass_link}?token=${resetToken}&email=${user.email}`;

  await emailSender(
    payload.email,
    `
    <div>
      <p>Dear User,</p>
      <p>Your password reset link:
        <a href="${resetPassLink}">
          <button>Reset Password</button>
        </a>
      </p>
    </div>
    `,
  );
};

// Reset password
const resetPassword = async (
  token: string,
  email: string,
  newPassword: string,
) => {
  let decodedData: JwtPayload;
  try {
    decodedData = jwtHelpers.verifyToken(
      token,
      config.reset_pass_token as Secret,
    );
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { email: decodedData.email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  if (user.email !== email) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { email: user.email },
    data: { password: hashedPassword },
  });

  return "Password reset successfully!";
};

export const AuthService = {
  loginUser,
  loginOrRegisterViaProvider,
  getMyProfile,
  refreshToken,
  changePassword,
  forgetPassword,
  resetPassword,
};
