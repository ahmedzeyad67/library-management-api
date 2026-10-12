import asyncWrapper from "../middlewares/async-wrapper.js";
import reservationService from "../services/reservation-service.js";

const getReservations = asyncWrapper(async (req, res) => {
  const data = await reservationService.getReservations(req.query, req.user);

  res.json({
    status: "success",
    ...data,
  });
});

const getReservationById = asyncWrapper(async (req, res) => {
  const reservation = await reservationService.getReservationById(
    req.params.reservationId,
    req.user,
  );

  res.json({ status: "success", data: reservation });
});

const createReservation = asyncWrapper(async (req, res) => {
  const reservation = await reservationService.createReservation(
    req.user.id,
    req.body.bookId,
  );

  res.json({ status: "success", data: reservation });
});

const cancelReservation = asyncWrapper(async (req, res) => {
  const reservation = await reservationService.cancelReservation(
    req.params.reservationId,
    req.user,
  );

  res.json({ status: "success", data: reservation });
});

const fulfillReservation = asyncWrapper(async (req, res) => {
  const loan = await reservationService.fulfillReservation(
    req.params.reservationId,
  );

  res.json({ status: "success", data: loan });
});

export default {
  getReservations,
  getReservationById,
  createReservation,
  cancelReservation,
  fulfillReservation,
};
