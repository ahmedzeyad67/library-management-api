import { Schema, model } from "mongoose";

const loanSchema = new Schema(
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
    borrowedAt: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        return dueDate;
      },
    },
    returnedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["borrowed", "returned", "overdue"],
      default: "borrowed",
    },
    fine: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

export default model("Loan", loanSchema);
