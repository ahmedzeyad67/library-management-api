import { query } from "express-validator";

const paginationValidator = (sortFields) => [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a valid number"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be a valid number between 1 and 100"),
  query("sort").optional().isIn(sortFields).withMessage("Invalid sort field"),
  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be either asc or desc"),
];

export default paginationValidator;
