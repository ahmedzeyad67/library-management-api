import { Schema, model } from "mongoose";
import BOOK_CATEGORIES from "../constants/book-categories.js";

const bookSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
      trim: true,
    },

    author: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 25,
      trim: true,
    },

    isbn: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 500,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: BOOK_CATEGORIES,
        message: "{VALUE} is not a valid category",
      },
    },

    publishedYear: {
      type: Number,
      required: true,
      min: 1000,
      max: new Date().getFullYear(),
    },

    totalCopies: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    availableCopies: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    coverImage: {
      url: {
        type: String,
      },
      publicId: {
        type: String,
        select: false,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default model("Book", bookSchema);
