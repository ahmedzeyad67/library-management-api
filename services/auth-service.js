import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user-model.js";
import RefreshToken from "../models/refreshToken-model.js";
import AppError from "../utils/app-error.js";
import hashToken from "../utils/hash-token.js";
import { verifyRefreshToken } from "../utils/jwt-verification.js";

const assignTokens = async (user, session) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET_KEY,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET_KEY,
    { expiresIn: "7d" },
  );

  await RefreshToken.create(
    [
      {
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    ],
    { session },
  );

  return { accessToken, refreshToken };
};

const registerUser = async (userData) => {
  const session = await mongoose.startSession();

  try {
    let tokens;

    await session.withTransaction(async () => {
      const newUser = new User({ ...userData, role: "user" });

      await newUser.save({ session });

      tokens = await assignTokens(newUser, session);
    });

    return tokens;
  } finally {
    await session.endSession();
  }
};

const loginUser = async (email, password) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account is inactive. Contact the administrator.",
      403,
    );
  }

  return assignTokens(user);
};

const logoutUser = async (refreshToken) => {
  await RefreshToken.findOneAndDelete({ token: hashToken(refreshToken) });
};

const refreshUserTokens = async (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  const session = await mongoose.startSession();

  try {
    let tokens;

    await session.withTransaction(async () => {
      const storedToken = await RefreshToken.findOneAndDelete({
        userId: decoded.id,
        token: hashToken(refreshToken),
      }).session(session);

      if (!storedToken) {
        throw new AppError("Invalid refresh token", 401);
      }

      const user = await User.findById(decoded.id).session(session);

      if (!user || !user.isActive) {
        throw new AppError("Account is inactive or does not exist", 401);
      }

      tokens = await assignTokens(user, session);
    });

    return tokens;
  } finally {
    await session.endSession();
  }
};

const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .select("+password")
        .session(session);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new AppError("Current password is incorrect", 401);
      }

      user.password = newPassword;
      await user.save({ session });

      await RefreshToken.deleteMany({ userId }, { session });
    });
  } finally {
    await session.endSession();
  }
};

export default {
  registerUser,
  loginUser,
  logoutUser,
  refreshUserTokens,
  getMe,
  changePassword,
};
