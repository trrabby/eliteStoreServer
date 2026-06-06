import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";

const generateToken = (
  payload: Record<string, any>,
  secret: Secret,
  expiresIn: string,
) => {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn,
  } as SignOptions);
};

const verifyToken = (token: string, secret: Secret) => {
  // console.log({ token, secret });

  const res = jwt.verify(token, secret) as JwtPayload;
  // console.log({ resfromVerify: res });
  return res;
};

const parseExpiryToMs = (value: string): number => {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 0;

  const num = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return num * multipliers[unit as keyof typeof multipliers];
};

export const jwtHelpers = { generateToken, verifyToken, parseExpiryToMs };
