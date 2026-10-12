import { body, query } from "express-validator";
import paginationValidator from "./pagination-validator.js";

const getReservations = [
  ...paginationValidator(["reservedAt", "pickupDeadline"]),
  query("status")
    .optional()
    .isIn(["pending", "approved", "fulfilled", "cancelled", "expired"])
    .withMessage("Invalid status value"),
];

const createReservation = [
  body("bookId")
    .notEmpty()
    .withMessage("Book ID is required")
    .isMongoId()
    .withMessage("Invalid Book ID"),
];

export default {
  getReservations,
  createReservation,
};
