import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { JwtPayload, Secret } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import prisma from "../../../shared/prisma";
import { jwtHelpers } from "../../../helpers/jwtHalpers";
import config from "../../../config";
import emailSender from "../../../shared/emailSender";
import { Role } from "@prisma/client";


// register user 
const registerUser = async (payload: any) => {
  if (!payload.email || !payload.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Email and password are required"
    );
  }
  const isAccountExists = await prisma.account.findUnique({
    where: { email: payload.email },
  });

  if (isAccountExists) {
    throw new AppError(httpStatus.BAD_REQUEST, "Account already exists");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(payload.email)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid email format");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const accountData = {
    email: payload.email,
    password: hashedPassword,
    role: Role.USER,
  };
  const result = await prisma.$transaction(async (tx) => {
    const createdAccount = await tx.account.create({ data: accountData });
    const userData = {
      name: payload.name,
      accountId: createdAccount.id,
    };
    await tx.user.create({ data: userData });
    return createdAccount;
  });
  return result;
};


// Login user
const loginUser = async (payload: { email: string; password: string }) => {
  const isUserExists = await prisma.account.findUnique({
    where: { email: payload.email, isDeleted: false },
  });
  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const isPasswordMatch = await bcrypt.compare(
    payload.password,
    isUserExists.password
  );

  if (!isPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid password");
  }

  const { password, ...userData } = isUserExists;

  const accessToken = jwtHelpers.generateToken(
    {
      email: userData.email,
      role: userData.role,
    },
    config.jwt_secret as Secret,
    config.expires_in as string
  );

  const refreshToken = jwtHelpers.generateToken(
    {
      email: userData.email,
      role: userData.role,
    },
    config.refresh_token_secret as Secret,
    config.refresh_token_expires_in as string
  );
  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
  };
};

// get my profile
const getMyProfile = async (email: string) => {
  const user = await prisma.account.findUnique({
    where: { email: email, isDeleted: false },
    include: {
      company: true,
      user: true,
      admin: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  return user;
};

// refresh token
const refreshToken = async (token: string) => {
  let decodedData;
  try {
    decodedData = jwtHelpers.verifyToken(
      token,
      config.refresh_token_secret as Secret
    );
  } catch (err) {
    throw new Error("You are not authorized!");
  }

  const userData = await prisma.account.findUniqueOrThrow({
    where: {
      email: decodedData.email,
      isDeleted: false,
    },
  });

  const accessToken = jwtHelpers.generateToken(
    {
      email: userData.email,
      role: userData.role,
    },
    config.jwt_secret as Secret,
    config.expires_in as string
  );

  return accessToken;
};

// change password
const changePassword = async (
  user: JwtPayload,
  payload: {
    oldPassword: string;
    newPassword: string;
  }
) => {
  const isExistAccount = await prisma.account.findUnique({
    where: {
      email: user.email,
      isDeleted: false,
    },
  });
  if (!isExistAccount) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found !");
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    isExistAccount.password
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 10);

  await prisma.account.update({
    where: {
      email: isExistAccount.email,
    },
    data: {
      password: hashedPassword,
    },
  });

  return "Password update is successful.";
};


/// forget password
const forgetPassword = async (email: string) => {
  const isAccountExists = await prisma.account.findUnique({
    where: {
      email: email,
      isDeleted: false,
    },
  });

  if (!isAccountExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const resetToken = jwtHelpers.generateToken(
    {
      email: isAccountExists.email,
      role: isAccountExists.role,
    },
    config.reset_pass_token as Secret,
    config.reset_pass_token_expires_in as string
  );

  const resetPassLink = `${config.reset_pass_link}?token=${resetToken}&email=${isAccountExists.email}`;

  await emailSender(
    email,
    `
        <div>
            <p>Dear User,</p>
            <p>Your password reset link 
                <a href=${resetPassLink}>
                    <button>
                        Reset Password
                    </button>
                </a>
            </p>

        </div>
        `
  );

  return "Reset password link sent to your email!";
};

const resetPassword = async (
  token: string,
  email: string,
  newPassword: string
) => {
  let decodedData: JwtPayload;
  try {
    decodedData = jwtHelpers.verifyToken(
      token,
      config.reset_pass_token as Secret
    );
  } catch (err) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired token");
  }

  const isAccountExists = await prisma.account.findUnique({
    where: {
      email: decodedData.email,
      isDeleted: false,
    },
  });
  if (!isAccountExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found!!");
  }
  if (isAccountExists.email !== email) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email");
  }

  const hashedPassword: string = await bcrypt.hash(newPassword, 10);

  await prisma.account.update({
    where: {
      email: isAccountExists.email,
    },
    data: {
      password: hashedPassword,
    },
  });

  return "Password reset successfully!";
};

export const AuthService = {
  registerUser,
  loginUser,
  getMyProfile,
  refreshToken,
  changePassword,
  forgetPassword,
  resetPassword,
};
