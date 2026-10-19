import mongoose from "mongoose";
import Book from "../models/book-model.js";
import Reservation from "../models/reservation-model.js";
import Loan from "../models/loan-model.js";
import AppError from "../utils/app-error.js";
import paginate from "../utils/pagination.js";
import promoteNextReservation from "../utils/promote-next-reservation.js";
import renamePopulatedFields from "../utils/rename-populated-fields.js";

const getReservations = async (queryParams, user) => {
  const { page, limit, sort, order, ...query } = queryParams;

  if (user.role !== "admin") {
    query.userId = user.id;
  }

  const result = await paginate(Reservation, query, {
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

const getReservationById = async (reservationId, user) => {
  const query = { _id: reservationId };

  if (user.role !== "admin") {
    query.userId = user.id;
  }

  const reservation = await Reservation.findOne(query).populate([
    { path: "userId", select: "firstName lastName email" },
    { path: "bookId", select: "title author isbn" },
  ]);

  if (!reservation) {
    throw new AppError("Reservation not found", 404);
  }

  return renamePopulatedFields(reservation);
};

const createReservation = async (userId, bookId) => {
  const session = await mongoose.startSession();

  try {
    let createdReservation;

    await session.withTransaction(async () => {
      const book = await Book.findById(bookId).session(session);

      if (!book) {
        throw new AppError("Book not found", 404);
      }

      if (!book.isActive) {
        throw new AppError("Book is not available for reservation", 400);
      }

      const existingReservation = await Reservation.findOne({
        userId,
        bookId,
        status: { $in: ["pending", "approved"] },
      }).session(session);

      if (existingReservation) {
        throw new AppError(
          "You already have an active reservation for this book",
          400,
        );
      }

      const activeLoan = await Loan.findOne({
        userId,
        bookId,
        status: { $in: ["borrowed", "overdue"] },
      }).session(session);

      if (activeLoan) {
        throw new AppError("You already have this book borrowed", 400);
      }

      const reservationData = { userId, bookId };

      const allocatedBook = await Book.findOneAndUpdate(
        {
          _id: bookId,
          isActive: true,
          availableCopies: { $gt: 0 },
        },
        { $inc: { availableCopies: -1 } },
        {
          returnDocument: "after",
          session,
        },
      );

      if (allocatedBook) {
        const pickupDeadline = new Date();
        pickupDeadline.setDate(pickupDeadline.getDate() + 3);

        reservationData.pickupDeadline = pickupDeadline;
        reservationData.status = "approved";
      } else {
        const touched = await Book.updateOne(
          { _id: bookId, isActive: true },
          { $set: { updatedAt: new Date() } },
          { session, timestamps: false },
        );

        if (touched.matchedCount === 0) {
          throw new AppError("Book is not available for reservation", 400);
        }

        reservationData.status = "pending";
      }

      const reservation = new Reservation(reservationData);
      await reservation.save({ session });

      createdReservation = reservation;
    });

    return createdReservation;
  } finally {
    await session.endSession();
  }
};

const cancelReservation = async (reservationId, user) => {
  const session = await mongoose.startSession();

  try {
    let cancelledReservation;

    await session.withTransaction(async () => {
      const query = { _id: reservationId };

      if (user.role !== "admin") {
        query.userId = user.id;
      }

      const reservation = await Reservation.findOne(query).session(session);

      if (!reservation) {
        throw new AppError("Reservation not found", 404);
      }

      if (!["pending", "approved"].includes(reservation.status)) {
        throw new AppError(
          "Only pending or approved reservations can be cancelled",
          400,
        );
      }

      if (reservation.status === "approved") {
        const book = await Book.findById(reservation.bookId).session(session);

        if (!book) {
          throw new AppError("Book not found for this reservation", 404);
        }

        book.availableCopies += 1;
        await book.save({ session });

        await promoteNextReservation(book, session);
      }

      reservation.status = "cancelled";

      await reservation.save({ session });

      cancelledReservation = reservation;
    });

    return cancelledReservation;
  } finally {
    await session.endSession();
  }
};

const fulfillReservation = async (reservationId) => {
  const session = await mongoose.startSession();

  try {
    let createdLoan;

    await session.withTransaction(async () => {
      const reservation =
        await Reservation.findById(reservationId).session(session);

      if (!reservation) {
        throw new AppError("Reservation not found", 404);
      }

      if (reservation.status !== "approved") {
        throw new AppError("Only approved reservations can be fulfilled", 400);
      }

      const loan = new Loan({
        userId: reservation.userId,
        bookId: reservation.bookId,
      });

      await loan.save({ session });

      reservation.status = "fulfilled";
      await reservation.save({ session });

      createdLoan = loan;
    });

    return createdLoan;
  } finally {
    await session.endSession();
  }
};

export default {
  getReservations,
  getReservationById,
  createReservation,
  cancelReservation,
  fulfillReservation,
};
