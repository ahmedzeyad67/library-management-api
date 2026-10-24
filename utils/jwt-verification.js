import jwt from "jsonwebtoken";
import AppError from "./app-error.js";

const verifyToken = (token, secret, message) => {
  try {
    return jwt.verify(token, secret);
  } catch {
    throw new AppError(message, 401);
  }
};

const verifyAccessToken = (token) => {
  return verifyToken(
    token,
    process.env.JWT_ACCESS_SECRET_KEY,
    "Unauthorized: Invalid or expired token",
  );
};

const verifyRefreshToken = (token) => {
  return verifyToken(
    token,
    process.env.JWT_REFRESH_SECRET_KEY,
    "Invalid refresh token",
  );
};

export { verifyAccessToken, verifyRefreshToken };
