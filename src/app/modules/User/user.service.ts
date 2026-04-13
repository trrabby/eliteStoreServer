import { reviewValidation } from "./../Review/review.validation";
import status from "http-status";

import { Request } from "express";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import uploadCloud from "../../../shared/cloudinary";
import { Role } from "@prisma/client";

// get all users
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
    },
    include: {
      account: {
        select: {
          id: true,
          email: true,
          role: true,
          isDeleted: true,
          status: true,
          isCompleteProfile: true,
        },
      },
    },
  });
  const count = await prisma.user.count({
    where: {
      isDeleted: false,
    },
  });

  return {
    count,
    users,
  };
};

// find by id
const getMyProfile = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      account: {
        select: {
          id: true,
          email: true,
          role: true,
          isDeleted: true,
          status: true,
          isCompleteProfile: true,
        },
      },
    },
  });
  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return user;
};

// find by email
const getAccountByEmail = async (email: string) => {
  const user = await prisma.account.findUnique({
    where: {
      email,
      isDeleted: false,
    },
    include: {
      user: true,
      reviews: true,
      votes: true,
      ReviewComment: true,
      Payment: true,
    },
  });
  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return user;
};

//make Admin
const makeAdmin = async (id: string) => {
  const user = await prisma.account.findUnique({
    where: {
      id: id,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const updatedAccount = await prisma.account.update({
    where: {
      id: id,
    },
    data: {
      role: Role.ADMIN,
    },
  });

  return {
    userId: user.id,
    newRole: updatedAccount.role,
  };
};

// update user
const updateMyProfile = async (email: string, req: Request) => {
  // find account and user account
  const isAccountExist = await prisma.account.findUnique({
    where: {
      email,
      isDeleted: false,
    },
    include: {
      user: true,
    },
  });
  if (!isAccountExist) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // main update logic
  if (req.file) {
    const uploadedImage = await uploadCloud(req.file);
    req.body.profileImage = uploadedImage?.secure_url;
  }

  const updateuserInfo = await prisma.$transaction(async (tClient) => {
    const updateData = await tClient.user.update({
      where: {
        id: isAccountExist?.user?.id,
      },
      data: req.body,
      include: {
        account: true,
      },
    });

    await tClient.account.update({
      where: {
        email,
      },
      data: {
        isCompleteProfile: true,
      },
    });
    return updateData;
  });
  return updateuserInfo;
};

// delete user
const deleteMyProfile = async (email: string) => {
  const isAccountExist = await prisma.account.findUnique({
    where: {
      email,
      isDeleted: false,
    },
    include: {
      user: true,
    },
  });
  if (!isAccountExist) {
    throw new AppError(status.NOT_FOUND, "Account not found");
  }

  return await prisma.$transaction(async (tClient) => {
    const deleteUser = await tClient.user.update({
      where: {
        id: isAccountExist?.user?.id,
      },
      data: {
        isDeleted: true,
      },
    });

    await tClient.account.update({
      where: {
        email,
      },
      data: {
        isDeleted: true,
      },
    });
    return { isDeleted: deleteUser.isDeleted };
  });
};

export const userService = {
  getAllUsers,
  getMyProfile,
  makeAdmin,
  updateMyProfile,
  deleteMyProfile,
  getAccountByEmail,
};
