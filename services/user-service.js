import User from "../models/user-model.js";
import AppError from "../utils/app-error.js";
import paginate from "../utils/pagination.js";
import nameSearchQuery from "../utils/name-search-query.js";
import escapeRegex from "../utils/escape-regex.js";

const getAllUsers = async (queryParams) => {
  const { page, limit, sort, order, search, ...query } = queryParams;

  if (search) {
    const searchQueries = [
      { email: { $regex: escapeRegex(search), $options: "i" } },
      { phone: { $regex: escapeRegex(search), $options: "i" } },
    ];

    const nameQuery = nameSearchQuery(search);
    if (nameQuery) {
      searchQueries.push(nameQuery);
    }

    query.$or = searchQueries;
  }

  return paginate(User, query, { page, limit, sort, order });
};

const updateMe = async (userId, userData) => {
  const { firstName, lastName, email, phone } = userData;

  const allowedUpdates = Object.fromEntries(
    Object.entries({ firstName, lastName, email, phone }).filter(
      ([, value]) => value !== undefined,
    ),
  );

  const updatedUser = await User.findByIdAndUpdate(userId, allowedUpdates, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return updatedUser;
};

const updateUserStatus = async (userId, isActive) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive },
    { returnDocument: "after", runValidators: true },
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const activateUser = async (userId) => {
  return updateUserStatus(userId, true);
};

const deactivateUser = async (userId) => {
  return updateUserStatus(userId, false);
};

export default {
  getAllUsers,
  updateMe,
  activateUser,
  deactivateUser,
};
