import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  email: process.env.EMAIL,
  app_pass: process.env.APP_PASS,
  jwt_secret: process.env.JWT_SECRET,
  expires_in: process.env.EXPIRES_IN,
  refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
  refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN,
  reset_pass_token: process.env.RESET_PASS_TOKEN,
  reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
  reset_pass_link: process.env.RESET_PASS_LINK,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  ssl: {
    storeId: process.env.STORE_ID,
    storePass: process.env.STORE_PASS,
    successUrl: process.env.SUCCESS_URL,
    cancelUrl: process.env.CANCEL_URL,
    failUrl: process.env.FAIL_URL,
    sslPaymentApi: process.env.SSL_PAYMENT_API,
    sslValidationApi: process.env.SSL_VALIDATIOIN_API,
    ipnUrl: process.env.SSL_IPN_URL,
    // for wallet topup callbacks
    walletSuccessUrl: process.env.WALLET_SUCCESS_URL,
    walletFailUrl: process.env.WALLET_FAIL_URL,
    walletCancelUrl: process.env.WALLET_CANCEL_URL,
  },
  bkash: {
    appKey: process.env.BKASH_APP_KEY,
    appSecret: process.env.BKASH_APP_SECRET,
    username: process.env.BKASH_USERNAME,
    password: process.env.BKASH_PASSWORD,
  },
  nagad: {
    merchantId: process.env.NAGAD_MERCHANT_ID,
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER,
    publicKey: process.env.NAGAD_PUBLIC_KEY,
    privateKey: process.env.NAGAD_PRIVATE_KEY,
    callbackUrl: process.env.NAGAD_CALLBACK_URL,
  },
  steadfast: {
    baseUrl: process.env.STEADFAST_BASE_URL,
    apiKey: process.env.STEADFAST_API_KEY,
    secretKey: process.env.STEADFAST_SECRET_KEY,
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  },
};
