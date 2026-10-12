import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.js";
import reservationsValidator from "../validators/reservation-validator.js";
import reservationsController from "../controllers/reservation-controller.js";
import validate from "../middlewares/validate.js";

const router = Router();

router
  .route("/")
  .get(
    authenticate,
    reservationsValidator.getReservations,
    validate,
    reservationsController.getReservations,
  )
  .post(
    authenticate,
    reservationsValidator.createReservation,
    validate,
    reservationsController.createReservation,
  );

router.get(
  "/:reservationId",
  authenticate,
  reservationsController.getReservationById,
);

router.patch(
  "/:reservationId/cancel",
  authenticate,
  reservationsController.cancelReservation,
);

router.patch(
  "/:reservationId/fulfill",
  authenticate,
  authorize("admin"),
  reservationsController.fulfillReservation,
);

export default router;
