import { query } from "express-validator";
import paginationValidator from "./pagination-validator.js";

const getLoans = [
  ...paginationValidator(["borrowedAt", "returnedAt"]),
  query("status")
    .optional()
    .isIn(["borrowed", "overdue", "returned"])
    .withMessage("Invalid status value"),
  query("userSearch")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("User search cannot be empty")
    .isLength({ max: 100 })
    .withMessage("User search must not exceed 100 characters"),
  query("bookSearch")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Book search cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Book search must not exceed 100 characters"),
  query("borrowedAt")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("borrowedAt must be in YYYY-MM-DD format")
    .bail()
    .isISO8601({ strict: true })
    .withMessage("borrowedAt must be a valid date in YYYY-MM-DD format"),
  query("returnedAt")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("returnedAt must be in YYYY-MM-DD format")
    .bail()
    .isISO8601({ strict: true })
    .withMessage("returnedAt must be a valid date in YYYY-MM-DD format"),
];

export default {
  getLoans,
};
