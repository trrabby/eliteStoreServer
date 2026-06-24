import axios from "axios";
import crypto from "crypto";
import { gatewayConfig } from "./payment.config";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type GatewayPaymentPayload = {
  orderId: number;
  orderNumber: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  mobileNumber?: string; // bKash / Nagad
  isAddMoney?: boolean; // optional flag
};

// ─────────────────────────────────────────
// SSLCOMMERZ
// ─────────────────────────────────────────

export const initiateSSLPayment = async (
  payload: GatewayPaymentPayload,
): Promise<{
  gatewayUrl: string;
  sessionKey: string;
  transactionId: string;
}> => {
  const cfg = gatewayConfig.sslcommerz;

  const tranId = `${payload.orderNumber}-${Date.now()}`;

  // 🔥 Conditional redirect URLs
  const successUrl = payload.isAddMoney ? cfg.walletSuccessUrl : cfg.successUrl;
  //  console.log(payload.isAddMoney, successUrl);

  const failUrl = payload.isAddMoney ? cfg.walletFailUrl : cfg.failUrl;

  const cancelUrl = payload.isAddMoney ? cfg.walletCancelUrl : cfg.cancelUrl;

  const data = {
    store_id: cfg.storeId,
    store_passwd: cfg.storePass,
    total_amount: payload.amount,
    currency: payload.currency,
    tran_id: tranId,

    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,

    ipn_url: cfg.ipnUrl,

    cus_name: payload.customerName,
    cus_email: payload.customerEmail,
    cus_phone: payload.customerPhone,
    cus_add1: "Bangladesh",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",

    shipping_method: "NO",
    product_name: `Order #${payload.orderNumber}`,
    product_category: "General",
    product_profile: "general",
  };

  const response = await axios.post(cfg.paymentApi, data, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (response.data?.status !== "SUCCESS") {
    throw new Error(
      response.data?.failedreason || "SSLCommerz initiation failed",
    );
  }

  return {
    gatewayUrl: response.data.GatewayPageURL,
    sessionKey: response.data.sessionkey,
    transactionId: tranId,
  };
};

export const validateSSLPayment = async (
  valId: string,
): Promise<{ isValid: boolean; transactionId: string; response: any }> => {
  const cfg = gatewayConfig.sslcommerz;

  const response = await axios.get(cfg.validationApi, {
    params: {
      val_id: valId,
      store_id: cfg.storeId,
      store_passwd: cfg.storePass,
      format: "json",
    },
  });

  const isValid =
    response.data?.status === "VALID" || response.data?.status === "VALIDATED";

  return {
    isValid,
    transactionId: response.data?.bank_tran_id ?? "",
    response: response.data,
  };
};

// ─────────────────────────────────────────
// BKASH
// ─────────────────────────────────────────

// bKash token — cached in memory, expires in 3600s
let bkashToken: { token: string; expiresAt: number } | null = null;

const getBkashToken = async (): Promise<string> => {
  // return cached token if still valid
  if (bkashToken && Date.now() < bkashToken.expiresAt) {
    return bkashToken.token;
  }

  const cfg = gatewayConfig.bkash;

  const response = await axios.post(
    `${cfg.baseUrl}/tokenized/checkout/token/grant`,
    {
      app_key: cfg.appKey,
      app_secret: cfg.appSecret,
    },
    {
      headers: {
        username: cfg.username,
        password: cfg.password,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.data?.statusCode !== "0000") {
    throw new Error("bKash token grant failed");
  }

  // cache the token — expires in 1 hour
  bkashToken = {
    token: response.data.id_token,
    expiresAt: Date.now() + 3500 * 1000,
  };

  return bkashToken.token;
};

export const initiateBkashPayment = async (
  payload: GatewayPaymentPayload,
): Promise<{ bkashURL: string; paymentID: string }> => {
  const cfg = gatewayConfig.bkash;
  const token = await getBkashToken();

  const response = await axios.post(
    `${cfg.baseUrl}/tokenized/checkout/create`,
    {
      mode: "0011",
      payerReference: payload.mobileNumber ?? payload.customerPhone,
      callbackURL: `${process.env.BKASH_CALLBACK_URL}?orderId=${payload.orderId}`,
      amount: payload.amount.toString(),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.orderNumber,
    },
    {
      headers: {
        Authorization: token,
        "X-APP-Key": cfg.appKey,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.data?.statusCode !== "0000") {
    throw new Error(
      response.data?.statusMessage || "bKash payment initiation failed",
    );
  }

  return {
    bkashURL: response.data.bkashURL,
    paymentID: response.data.paymentID,
  };
};

export const executeBkashPayment = async (
  paymentID: string,
): Promise<{ isSuccess: boolean; transactionId: string; response: any }> => {
  const cfg = gatewayConfig.bkash;
  const token = await getBkashToken();

  const response = await axios.post(
    `${cfg.baseUrl}/tokenized/checkout/execute`,
    { paymentID },
    {
      headers: {
        Authorization: token,
        "X-APP-Key": cfg.appKey,
        "Content-Type": "application/json",
      },
    },
  );

  const isSuccess = response.data?.statusCode === "0000";

  return {
    isSuccess,
    transactionId: response.data?.trxID ?? "",
    response: response.data,
  };
};

export const refundBkashPayment = async (
  paymentID: string,
  transactionId: string,
  amount: number,
  orderNumber: string,
): Promise<{ isSuccess: boolean; response: any }> => {
  const cfg = gatewayConfig.bkash;
  const token = await getBkashToken();

  const response = await axios.post(
    `${cfg.baseUrl}/tokenized/checkout/payment/refund`,
    {
      paymentID,
      trxID: transactionId,
      amount: amount.toString(),
      currency: "BDT",
      merchantInvoiceNumber: orderNumber,
      reason: "Customer request",
    },
    {
      headers: {
        Authorization: token,
        "X-APP-Key": cfg.appKey,
        "Content-Type": "application/json",
      },
    },
  );

  const isSuccess = response.data?.statusCode === "0000";

  return {
    isSuccess,
    response: response.data,
  };
};

// ─────────────────────────────────────────
// NAGAD
// ─────────────────────────────────────────

const encryptWithPublicKey = (data: string, publicKey: string): string => {
  const buffer = Buffer.from(data);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer,
  );
  return encrypted.toString("base64");
};

const signWithPrivateKey = (data: string, privateKey: string): string => {
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, "base64");
};

export const initiateNagadPayment = async (
  payload: GatewayPaymentPayload,
): Promise<{ callBackUrl: string }> => {
  const cfg = gatewayConfig.nagad;
  const datetime = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const sensitiveData = {
    merchantId: cfg.merchantId,
    datetime,
    orderId: payload.orderNumber,
    challenge: crypto.randomBytes(16).toString("hex"),
  };

  const encryptedData = encryptWithPublicKey(
    JSON.stringify(sensitiveData),
    cfg.publicKey,
  );
  const signature = signWithPrivateKey(
    JSON.stringify(sensitiveData),
    cfg.privateKey,
  );

  // Step 1 — initialize
  const initResponse = await axios.post(
    `${cfg.baseUrl}/api/dfs/check-out/initialize/${cfg.merchantId}/${payload.orderNumber}`,
    {
      dateTime: datetime,
      sensitiveData: encryptedData,
      signature,
    },
    {
      headers: {
        "X-KM-Api-Version": "v-0.2.0",
        "X-KM-IP-V4": "127.0.0.1",
        "X-KM-Client-Type": "PC_WEB",
        "Content-Type": "application/json",
      },
    },
  );

  if (!initResponse.data?.sensitiveData) {
    throw new Error("Nagad initialization failed");
  }

  // Step 2 — complete
  const checkoutSensitiveData = {
    merchantId: cfg.merchantId,
    orderId: payload.orderNumber,
    currencyCode: "050",
    amount: payload.amount.toString(),
    challenge: initResponse.data.sensitiveData,
  };

  const checkoutEncryptedData = encryptWithPublicKey(
    JSON.stringify(checkoutSensitiveData),
    cfg.publicKey,
  );

  const checkoutSignature = signWithPrivateKey(
    JSON.stringify(checkoutSensitiveData),
    cfg.privateKey,
  );

  const checkoutResponse = await axios.post(
    `${cfg.baseUrl}/api/dfs/check-out/complete/${cfg.merchantId}/${payload.orderNumber}`,
    {
      sensitiveData: checkoutEncryptedData,
      signature: checkoutSignature,
      merchantCallbackURL: cfg.callbackUrl,
    },
    {
      headers: {
        "X-KM-Api-Version": "v-0.2.0",
        "X-KM-IP-V4": "127.0.0.1",
        "X-KM-Client-Type": "PC_WEB",
        "Content-Type": "application/json",
      },
    },
  );

  if (!checkoutResponse.data?.callBackUrl) {
    throw new Error("Nagad checkout failed");
  }

  return { callBackUrl: checkoutResponse.data.callBackUrl };
};

export const verifyNagadPayment = async (
  paymentRefId: string,
): Promise<{ isSuccess: boolean; transactionId: string; response: any }> => {
  const cfg = gatewayConfig.nagad;

  const response = await axios.get(
    `${cfg.baseUrl}/api/dfs/verify/payment/${paymentRefId}`,
    {
      headers: {
        "X-KM-Api-Version": "v-0.2.0",
        "Content-Type": "application/json",
      },
    },
  );

  const isSuccess = response.data?.status === "Success";

  return {
    isSuccess,
    transactionId: response.data?.merchantInvoiceNumber ?? "",
    response: response.data,
  };
};
