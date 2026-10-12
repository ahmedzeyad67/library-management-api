import Book from "../models/book-model.js";
import Reservation from "../models/reservation-model.js";
import Loan from "../models/loan-model.js";
import AppError from "../utils/app-error.js";
import paginate from "../utils/pagination.js";
import promoteNextReservation from "../utils/reservation-helper.js";
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
  const book = await Book.findById(bookId);

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  if (!book.isActive) {
    throw new AppError("Book is not available for reservation", 400);
  }

  const [existingReservation, activeLoan] = await Promise.all([
    Reservation.findOne({
      userId,
      bookId,
      status: { $in: ["pending", "approved"] },
    }),

    Loan.findOne({
      userId,
      bookId,
      status: { $in: ["borrowed", "overdue"] },
    }),
  ]);

  if (existingReservation) {
    throw new AppError(
      "You already have an active reservation for this book",
      400,
    );
  }

  if (activeLoan) {
    throw new AppError("You already have this book borrowed", 400);
  }

  const reservationData = {
    userId,
    bookId,
  };

  if (book.availableCopies > 0) {
    const pickupDeadline = new Date();

    pickupDeadline.setDate(pickupDeadline.getDate() + 3);

    reservationData.pickupDeadline = pickupDeadline;
    reservationData.status = "approved";

    book.availableCopies -= 1;

    await book.save();
  }

  const reservation = await Reservation.create(reservationData);

  return reservation;
};

const cancelReservation = async (reservationId, user) => {
  const query = { _id: reservationId };

  if (user.role !== "admin") {
    query.userId = user.id;
  }

  const reservation = await Reservation.findOne(query);

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
    const book = await Book.findById(reservation.bookId);

    if (book) {
      book.availableCopies += 1;
      await book.save();

      await promoteNextReservation(book);
    }
  }

  reservation.status = "cancelled";

  await reservation.save();

  return reservation;
};

const fulfillReservation = async (reservationId) => {
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    throw new AppError("Reservation not found", 404);
  }

  if (reservation.status !== "approved") {
    throw new AppError("Only approved reservations can be fulfilled", 400);
  }

  const loan = await Loan.create({
    userId: reservation.userId,
    bookId: reservation.bookId,
  });

  reservation.status = "fulfilled";
  await reservation.save();

  return loan;
};

export default {
  getReservations,
  getReservationById,
  createReservation,
  cancelReservation,
  fulfillReservation,
};
