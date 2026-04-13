import httpStatus from "http-status";
import { Request } from "express";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";
import uploadCloud from "../../../shared/cloudinary";
import { PaymentStatus, Review, ReviewStatus, Role } from "@prisma/client";
import { SSLService } from "../SSL/ssl.service";

/// create review
const createReview = async (req: Request) => {
  const payload = req.body;

  const isAccountExist = await prisma.account.findUnique({
    where: { id: payload.accountId },
  });

  console.log(isAccountExist);

  if (!isAccountExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  }

  const isProductExist = await prisma.product.findUnique({
    where: { id: payload.productId },
  });

  console.log(isProductExist);

  if (!isProductExist) {
    throw new AppError(httpStatus.NOT_FOUND, "product not found");
  }

  if (req.file) {
    const uploadedImage = await uploadCloud(req.file);
    req.body.companyImage = uploadedImage?.secure_url;
  }

  const result = await prisma.review.create({
    data: {
      ...payload,
    },
  });

  return result;
};

/// get review
const getReviews = async () => {
  const result = await prisma.review.findMany({
    include: {
      product: true,
      account: {
        select: {
          id: true,
          email: true,
        },
      },
      _count: {
        select: {
          votes: true,
          ReviewComment: true,
        },
      },
    },
  });
  return result;
};

/// get a review
const getAReview = async (id: string) => {
  const result = await prisma.review.findUniqueOrThrow({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      product: true,
      account: {
        select: {
          id: true,
          email: true,
        },
      },
      _count: {
        select: {
          votes: true,
          ReviewComment: true,
        },
      },
    },
  });

  return result;
};

/// update review
const updateAReview = async (id: string, data: Partial<Review>) => {
  await prisma.review.findUniqueOrThrow({
    where: { id },
  });

  if (!data || Object.keys(data).length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "No data provided to update");
  }

  const result = await prisma.review.update({
    where: { id },
    data,
  });

  return result;
};

/// delete review
const deleteAReview = async (id: string) => {
  await prisma.review.findUniqueOrThrow({ where: { id: id } });

  const result = await prisma.review.update({
    where: { id: id, isDeleted: false },
    data: { isDeleted: true },
  });
  return result;
};

// init Premium Payment
const initPremiumPayment = async (reviewId: string, payLoad: any) => {
  const review = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
    include: {
      account: {
        select: {
          id: true,
          email: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Premium review not found");
  }

  if (!review.premiumPrice || review.premiumPrice <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid premium price");
  }

  // Begin transaction
  const [updatedReview, payment] = await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { isPremium: true },
    }),

    prisma.payment.create({
      data: {
        amount: review.premiumPrice,
        status: PaymentStatus.PENDING,
        accountId: review.accountId,
        reviewId: review.id,
        currency: "BDT",
      },
    }),
  ]);

  // Prepare SSLCommerz payload
  const paymentData = {
    amount: review.premiumPrice,
    transactionId: payment.id,
    name: payLoad?.name,
    email: review.account.email,
    address: payLoad.address,
    phoneNumber: payLoad.number,
  };

  // Initiate payment
  const result = await SSLService.initPayment(paymentData);

  return {
    paymentUrl: result.GatewayPageURL,
    paymentId: payment.id,
  };
};

const validatePremiumPayment = async (payload: any) => {
  // Validate payment with SSLCommerz
  const validationResponse = await SSLService.validatePayment(payload);

  // Update payment status
  await prisma.payment.update({
    where: { id: payload.tran_id },
    data: {
      status: PaymentStatus.COMPLETED,
      paymentGatewayData: validationResponse,
    },
    include: {
      review: true,
    },
  });

  return {
    success: true,
    message: "Payment completed successfully",
  };
};

export const reviewService = {
  createReview,
  getReviews,
  getAReview,
  updateAReview,
  deleteAReview,
  initPremiumPayment,
  validatePremiumPayment,
};
