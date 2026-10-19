import { DateTime } from "luxon";

const DAILY_FINE_RATE = 15;

const calculateFine = (dueDate) => {
  const dueDay = DateTime.fromJSDate(dueDate, {
    zone: "Africa/Cairo",
  }).startOf("day");

  const returnDay = DateTime.now().setZone("Africa/Cairo").startOf("day");

  const overdueDays = Math.max(0, returnDay.diff(dueDay, "days").days);

  return overdueDays * DAILY_FINE_RATE;
};

export default calculateFine;
