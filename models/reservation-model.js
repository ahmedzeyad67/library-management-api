import { Schema, model } from "mongoose";

const reservationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "fulfilled", "cancelled", "expired"],
      default: "pending",
    },
    reservedAt: {
      type: Date,
      default: Date.now,
    },
    pickupDeadline: {
      type: Date,
    },
  },
  { timestamps: true },
);

reservationSchema.index(
  { userId: 1, bookId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "approved"] },
    },
    name: "unique_active_reservation",
  },
);

reservationSchema.index(
  { bookId: 1, status: 1, reservedAt: 1 },
  {
    name: "book_pending_queue",
  },
);

export default model("Reservation", reservationSchema);
