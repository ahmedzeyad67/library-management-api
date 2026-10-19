import User from "../models/user-model.js";
import asyncWrapper from "./async-wrapper.js";
import AppError from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt-verification.js";

const authenticate = asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Unauthorized: Missing or invalid token", 401);
  }

  const token = authHeader.split(" ")[1];

  const decoded = verifyAccessToken(token);

  const user = await User.findById(decoded.id).select("isActive");

  if (!user || !user.isActive) {
    throw new AppError("Account is inactive or does not exist", 401);
  }

  req.user = decoded;

  next();
});

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("Access denied", 403);
    }

    next();
  };
};

export { authenticate, authorize };
