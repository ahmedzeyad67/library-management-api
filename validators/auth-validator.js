import { body } from "express-validator";

const registerUser = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 25 })
    .withMessage("First name must be between 2 and 25 characters long"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 25 })
    .withMessage("Last name must be between 2 and 25 characters long"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .isLength({ max: 50 })
    .withMessage("Email must be at most 50 characters long"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone("any")
    .withMessage("Please enter a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be at most 20 characters long"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("role")
    .not()
    .exists()
    .withMessage("Role cannot be provided during registration"),
];

const loginUser = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const logoutUser = [
  body("refreshToken")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

const refreshUser = [
  body("refreshToken")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

const changePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage("New password cannot be the same as the current password"),
];

export default {
  registerUser,
  loginUser,
  logoutUser,
  refreshUser,
  changePassword,
};
