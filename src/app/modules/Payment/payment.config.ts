import config from "../../../config";

export const gatewayConfig = {
  sslcommerz: {
    storeId: config.ssl.storeId as string,
    storePass: config.ssl.storePass as string,
    successUrl: config.ssl.successUrl as string,
    cancelUrl: config.ssl.cancelUrl as string,
    failUrl: config.ssl.failUrl as string,
    paymentApi: config.ssl.sslPaymentApi as string,
    validationApi: config.ssl.sslValidationApi as string,
    ipnUrl: config.ssl.ipnUrl as string,
    isLive: process.env.NODE_ENV === "production",
    // wallet callback URLs for topups
    walletSuccessUrl: config.ssl.walletSuccessUrl as string,
    walletFailUrl: config.ssl.walletFailUrl as string,
    walletCancelUrl: config.ssl.walletCancelUrl as string,
  },

  bkash: {
    appKey: process.env.BKASH_APP_KEY as string,
    appSecret: process.env.BKASH_APP_SECRET as string,
    username: process.env.BKASH_USERNAME as string,
    password: process.env.BKASH_PASSWORD as string,
    baseUrl:
      process.env.NODE_ENV === "production"
        ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
        : "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  },

  nagad: {
    merchantId: process.env.NAGAD_MERCHANT_ID as string,
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER as string,
    publicKey: process.env.NAGAD_PUBLIC_KEY as string,
    privateKey: process.env.NAGAD_PRIVATE_KEY as string,
    baseUrl:
      process.env.NODE_ENV === "production"
        ? "https://api.mynagad.com"
        : "http://sandbox.mynagad.com:10080",
    callbackUrl: process.env.NAGAD_CALLBACK_URL as string,
  },
};
