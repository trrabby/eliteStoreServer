export const steadfastConfig = {
  baseUrl: process.env.STEADFAST_BASE_URL ?? "https://portal.packzy.com/api/v1",
  apiKey: process.env.STEADFAST_API_KEY as string,
  secretKey: process.env.STEADFAST_SECRET_KEY as string,
};
