import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.js";
import loanscontroller from "../controllers/loan-controller.js";
import loansValidator from "../validators/loan-validator.js";
import validate from "../middlewares/validate.js";

const router = Router();

router.get(
  "/",
  authenticate,
  loansValidator.getLoans,
  validate,
  loanscontroller.getLoans,
);

router.get("/:loanId", authenticate, loanscontroller.getLoanById);

router.patch(
  "/:loanId/return",
  authenticate,
  authorize("admin"),
  loanscontroller.returnLoan,
);

export default router;
