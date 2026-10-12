import { Schema, model } from "mongoose";

const ReservationSchema = new Schema(
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

export default model("Reservation", ReservationSchema);
