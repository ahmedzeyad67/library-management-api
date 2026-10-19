import { body, query } from "express-validator";
import paginationValidator from "./pagination-validator.js";

const getAllUsers = [
  ...paginationValidator(["firstName", "lastName", "email", "createdAt"]),
  query("search")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Search term cannot be empty"),
  query("role")
    .optional()
    .isIn(["user", "admin"])
    .withMessage("Role must be either 'user' or 'admin'"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

const updateMe = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 25 })
    .withMessage("First name must be between 2 and 25 characters long"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 25 })
    .withMessage("Last name must be between 2 and 25 characters long"),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email")
    .isLength({ max: 50 })
    .withMessage("Email must be at most 50 characters long"),
  body("phone")
    .optional()
    .trim()
    .isMobilePhone("any")
    .withMessage("Please enter a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be at most 20 characters long"),
  body()
    .custom(
      (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value),
    )
    .withMessage("Request body must be an object")
    .custom((value) => Object.keys(value).length > 0)
    .withMessage("At least one field must be provided")
    .custom((value) => {
      const allowedFields = ["firstName", "lastName", "email", "phone"];

      return Object.keys(value).every((field) => allowedFields.includes(field));
    })
    .withMessage(
      "Only firstName, lastName, email, and phone fields are allowed",
    ),
];

export default {
  getAllUsers,
  updateMe,
};
