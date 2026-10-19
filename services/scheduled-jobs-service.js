import mongoose from "mongoose";
import Reservation from "../models/reservation-model.js";
import Book from "../models/book-model.js";
import Loan from "../models/loan-model.js";
import AppError from "../utils/app-error.js";
import promoteNextReservation from "../utils/promote-next-reservation.js";

const expireReservations = async () => {
  const now = new Date();

  const reservations = await Reservation.find({
    status: "approved",
    pickupDeadline: { $lte: now },
  }).select("_id bookId");

  let expiredCount = 0;

  for (const reservation of reservations) {
    const session = await mongoose.startSession();

    try {
      let thisReservationExpired = false;

      await session.withTransaction(async () => {
        thisReservationExpired = false;

        const expiredReservation = await Reservation.findOneAndUpdate(
          {
            _id: reservation._id,
            status: "approved",
            pickupDeadline: { $lte: now },
          },
          { status: "expired" },
          { returnDocument: "after", session },
        );

        if (!expiredReservation) {
          return;
        }

        const book = await Book.findById(reservation.bookId).session(session);

        if (!book) {
          throw new AppError("Book not found for the expired reservation", 404);
        }

        book.availableCopies += 1;
        await book.save({ session });

        await promoteNextReservation(book, session);

        thisReservationExpired = true;
      });

      if (thisReservationExpired) {
        expiredCount++;
      }
    } finally {
      await session.endSession();
    }
  }

  return expiredCount;
};

const markOverdueLoans = async () => {
  const overdueLoans = await Loan.updateMany(
    {
      status: "borrowed",
      dueDate: { $lt: new Date() },
    },
    { status: "overdue" },
  );

  return overdueLoans.modifiedCount;
};

export default { expireReservations, markOverdueLoans };
