import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.js";
import usersController from "../controllers/user-controller.js";
import usersValidator from "../validators/user-validator.js";
import validate from "../middlewares/validate.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin"),
  usersValidator.getAllUsers,
  validate,
  usersController.getAllUsers,
);

router.patch(
  "/me",
  authenticate,
  usersValidator.updateMe,
  validate,
  usersController.updateMe,
);

router.patch(
  "/:userId/activate",
  authenticate,
  authorize("admin"),
  usersController.activateUser,
);

router.patch(
  "/:userId/deactivate",
  authenticate,
  authorize("admin"),
  usersController.deactivateUser,
);

export default router;
