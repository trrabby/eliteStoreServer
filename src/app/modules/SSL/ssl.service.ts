import axios from "axios";
import config from "../../../config";
import httpStatus from "http-status";
import AppError from "../../errors/AppError";

const initPayment = async (paymentData: any) => {
  try {
    const data = {
      store_id: config.ssl.storeId,
      store_passwd: config.ssl.storePass,
      total_amount: paymentData.amount,
      currency: "BDT",
      tran_id: paymentData.transactionId,
      success_url: config.ssl.successUrl,
      fail_url: config.ssl.failUrl,
      cancel_url: config.ssl.cancelUrl,
      ipn_url: config.ssl.ipnUrl,
      shipping_method: "N/A",
      product_name: "Premium Review Access",
      product_category: "Digital Service",
      product_profile: "general",
      cus_name: paymentData.name,
      cus_email: paymentData.email,
      cus_add1: paymentData.address || "N/A",
      cus_add2: "N/A",
      cus_city: "N/A",
      cus_state: "N/A",
      cus_postcode: "N/A",
      cus_country: "N/A",
      cus_phone: paymentData.phoneNumber || "N/A",
      cus_fax: "N/A",
      ship_name: "N/A",
      ship_add1: "N/A",
      ship_add2: "N/A",
      ship_city: "N/A",
      ship_state: "N/A",
      ship_postcode: "N/A",
      ship_country: "N/A",
    };

    const response = await axios({
      method: "post",
      url: config.ssl.sslPaymentApi,
      data: data,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data;
  } catch (err) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment error occurred!");
  }
};

const validatePayment = async (payload: any) => {
  try {
    const response = await axios({
      method: "GET",
      url: `${config.ssl.sslValidationApi}?val_id=${payload.val_id}&store_id=${config.ssl.storeId}&store_passwd=${config.ssl.storePass}&format=json`,
    });

    return response.data;
  } catch (err) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment validation failed!");
  }
};

export const SSLService = {
  initPayment,
  validatePayment,
};
