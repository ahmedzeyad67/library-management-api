import { body, query } from "express-validator";
import paginationValidator from "./pagination-validator.js";

function isValidISBN(value) {
  const isbn = value.replace(/[-\s]/g, "");

  // ISBN-10
  if (/^\d{9}[\dX]$/.test(isbn)) {
    let sum = 0;

    for (let i = 0; i < 10; i++) {
      const digit = isbn[i] === "X" ? 10 : Number(isbn[i]);
      sum += digit * (10 - i);
    }

    return sum % 11 === 0;
  }

  // ISBN-13
  if (/^\d{13}$/.test(isbn)) {
    let sum = 0;

    for (let i = 0; i < 13; i++) {
      const digit = Number(isbn[i]);
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    return sum % 10 === 0;
  }

  return false;
}

const getActiveBooks = [
  ...paginationValidator(["title", "author", "publishedYear", "createdAt"]),
  query("isActive")
    .not()
    .exists()
    .withMessage("isActive query parameter is not allowed"),
];

const getAllBooks = [
  ...paginationValidator(["title", "author", "publishedYear", "createdAt"]),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

const createBook = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Title must be between 2 and 50 characters long"),
  body("author")
    .trim()
    .notEmpty()
    .withMessage("Author is required")
    .isLength({ min: 2, max: 25 })
    .withMessage("Author name must be between 2 and 25 characters long"),
  body("isbn")
    .trim()
    .notEmpty()
    .withMessage("ISBN is required")
    .custom((value) => {
      if (!isValidISBN(value)) {
        throw new Error("Invalid ISBN format");
      }
      return true;
    }),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 25 })
    .withMessage("Category must be between 2 and 25 characters long"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters long"),
  body("publishedYear")
    .notEmpty()
    .withMessage("Published year is required")
    .isInt({ min: 1000, max: new Date().getFullYear() })
    .withMessage("Published year must be a valid year"),
  body("totalCopies")
    .isInt({ min: 1 })
    .withMessage("Total copies must be at least 1"),
  body("coverImage")
    .optional()
    .trim()
    .isURL()
    .withMessage("Cover image must be a valid URL"),
  body()
    .custom((value) => !Object.hasOwn(value, "availableCopies"))
    .withMessage("availableCopies field cannot be set manually"),
];

const updateBook = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Title must be between 2 and 50 characters long"),
  body("author")
    .optional()
    .trim()
    .isLength({ min: 2, max: 25 })
    .withMessage("Author name must be between 2 and 25 characters long"),
  body("isbn")
    .optional()
    .trim()
    .custom((value) => {
      if (!isValidISBN(value)) {
        throw new Error("Invalid ISBN format");
      }
      return true;
    }),
  body("category")
    .optional()
    .trim()
    .isLength({ min: 2, max: 25 })
    .withMessage("Category must be between 2 and 25 characters long"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters long"),
  body("publishedYear")
    .optional()
    .isInt({ min: 1000, max: new Date().getFullYear() })
    .withMessage("Published year must be a valid year"),
  body("totalCopies")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total copies must be at least 1"),
  body("coverImage")
    .optional()
    .trim()
    .isURL()
    .withMessage("Cover image must be a valid URL"),
  body()
    .custom((value) => !Object.hasOwn(value, "availableCopies"))
    .withMessage("availableCopies field cannot be set manually"),
  body()
    .custom((value) => Object.keys(value).length > 0)
    .withMessage("At least one field must be provided for update"),
];

export default {
  getActiveBooks,
  getAllBooks,
  createBook,
  updateBook,
};
