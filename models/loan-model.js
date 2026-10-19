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

loanSchema.index(
  { userId: 1, bookId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["borrowed", "overdue"] } },
    name: "unique_active_loan",
  },
);

loanSchema.index(
  { status: 1, dueDate: 1 },
  {
    name: "loan_overdue_lookup",
  },
);

export default model("Loan", loanSchema);
