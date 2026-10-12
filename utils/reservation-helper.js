import Reservation from "../models/reservation-model.js";

const promoteNextReservation = async (book) => {
  if (book.availableCopies <= 0) {
    return;
  }

  const nextReservation = await Reservation.findOne({
    bookId: book._id,
    status: "pending",
  }).sort({ reservedAt: 1 });

  if (!nextReservation) {
    return;
  }

  const pickupDeadline = new Date();

  pickupDeadline.setDate(pickupDeadline.getDate() + 3);

  nextReservation.pickupDeadline = pickupDeadline;
  nextReservation.status = "approved";

  book.availableCopies -= 1;

  await Promise.all([nextReservation.save(), book.save()]);
};

export default promoteNextReservation;
