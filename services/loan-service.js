import mongoose from "mongoose";
import { DateTime } from "luxon";
import User from "../models/user-model.js";
import Book from "../models/book-model.js";
import Loan from "../models/loan-model.js";
import AppError from "../utils/app-error.js";
import paginate from "../utils/pagination.js";
import promoteNextReservation from "../utils/promote-next-reservation.js";
import nameSearchQuery from "../utils/name-search-query.js";
import renamePopulatedFields from "../utils/rename-populated-fields.js";
import calculateFine from "../utils/calculate-fine.js";
import escapeRegex from "../utils/escape-regex.js";

const getDayRange = (date) => {
  const startDate = DateTime.fromISO(date, {
    zone: "Africa/Cairo",
  }).startOf("day");

  const endDate = startDate.plus({ days: 1 });

  return {
    $gte: startDate.toUTC().toJSDate(),
    $lt: endDate.toUTC().toJSDate(),
  };
};

const getLoans = async (queryParams, user) => {
  const {
    page,
    limit,
    sort,
    order,
    userSearch,
    bookSearch,
    borrowedAt,
    returnedAt,
    ...query
  } = queryParams;

  if (user.role !== "admin") {
    query.userId = user.id;
  }

  if (userSearch && user.role === "admin") {
    const nameQuery = nameSearchQuery(userSearch);

    const users = await User.find(nameQuery).select("_id");

    query.userId = { $in: users.map((user) => user._id) };
  }

  if (bookSearch) {
    const books = await Book.find({
      title: { $regex: escapeRegex(bookSearch), $options: "i" },
    }).select("_id");

    query.bookId = { $in: books.map((book) => book._id) };
  }

  if (borrowedAt) {
    query.borrowedAt = getDayRange(borrowedAt);
  }

  if (returnedAt) {
    query.returnedAt = getDayRange(returnedAt);
  }

  const result = await paginate(Loan, query, {
    page,
    limit,
    sort,
    order,
    populate: [
      { path: "userId", select: "firstName lastName email" },
      { path: "bookId", select: "title author isbn" },
    ],
  });

  return {
    ...result,
    data: result.data.map(renamePopulatedFields),
  };
};

const getLoanById = async (loanId, user) => {
  const query = { _id: loanId };

  if (user.role !== "admin") {
    query.userId = user.id;
  }

  const loan = await Loan.findOne(query).populate([
    { path: "userId", select: "firstName lastName email" },
    { path: "bookId", select: "title author isbn" },
  ]);

  if (!loan) {
    throw new AppError("Loan not found", 404);
  }

  return renamePopulatedFields(loan);
};

const returnLoan = async (loanId) => {
  const session = await mongoose.startSession();

  try {
    let returnedLoan;

    await session.withTransaction(async () => {
      const loan = await Loan.findById(loanId).session(session);

      if (!loan) {
        throw new AppError("Loan not found", 404);
      }

      if (loan.status === "returned") {
        throw new AppError("Loan has already been returned", 400);
      }

      const book = await Book.findById(loan.bookId).session(session);

      if (!book) {
        throw new AppError("Book not found for this loan", 404);
      }

      loan.status = "returned";
      loan.returnedAt = new Date();
      loan.fine = calculateFine(loan.dueDate);
      await loan.save({ session });

      book.availableCopies += 1;
      await book.save({ session });

      await promoteNextReservation(book, session);

      returnedLoan = loan;
    });

    return returnedLoan;
  } finally {
    await session.endSession();
  }
};

export default {
  getLoans,
  getLoanById,
  returnLoan,
};
