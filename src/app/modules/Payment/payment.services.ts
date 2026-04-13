import prisma from "../../../shared/prisma";
import { SSLService } from "../SSL/ssl.service";
import { PaymentStatus } from "@prisma/client";

/// get review
const getPayments = async () => {
  const result = await prisma.payment.findMany();
  return result;
};

const initPayment = async (paymentData: any) => {
  // Prepare SSLCommerz payload
  const data = {
    amount: paymentData.amount,
    transactionId: paymentData.transactionId,
    name: paymentData.name,
    email: paymentData.email,
    address: paymentData.address,
    phoneNumber: paymentData.phoneNumber,
  };

  const result = await SSLService.initPayment(data);
  console.log(result);
  return result;
};

const validatePayment = async (payload: any) => {
  const response = await SSLService.validatePayment(payload);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: {
        id: response.tran_id,
      },
      data: {
        status: PaymentStatus.COMPLETED,
        paymentGatewayData: response,
      },
    });
  });

  return {
    message: "Payment validated successfully",
  };
};

export const PaymentService = {
  getPayments,
  initPayment,
  validatePayment,
};
