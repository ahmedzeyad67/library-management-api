import { afterEach, describe, expect, it, vi } from "vitest";
import Reservation from "../../../models/reservation-model.js";
import promoteNextReservation from "../../../utils/promote-next-reservation.js";

vi.mock("../../../models/reservation-model.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

describe("promoteNextReservation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does nothing when the book has no available copies", async () => {
    const book = { _id: "book-1", availableCopies: 0 };
    const session = { id: "session-1" };

    await promoteNextReservation(book, session);

    expect(Reservation.findOne).not.toHaveBeenCalled();
  });

  it("does nothing when there is no pending reservations", async () => {
    const query = {
      sort: vi.fn().mockReturnThis(),
      session: vi.fn().mockResolvedValue(null),
    };
    Reservation.findOne.mockReturnValue(query);

    const book = { _id: "book-1", availableCopies: 1 };
    const session = { id: "session-1" };

    await promoteNextReservation(book, session);

    expect(Reservation.findOne).toHaveBeenCalledWith({
      bookId: "book-1",
      status: "pending",
    });
    expect(query.sort).toHaveBeenCalledWith({ reservedAt: 1 });
    expect(query.session).toHaveBeenCalledWith(session);
    expect(book.availableCopies).toBe(1);
  });

  it("promotes the oldest pending reservation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));

    const reservation = {
      status: "pending",
      save: vi.fn().mockResolvedValue(undefined),
    };
    const query = {
      sort: vi.fn().mockReturnThis(),
      session: vi.fn().mockResolvedValue(reservation),
    };
    Reservation.findOne.mockReturnValue(query);

    const book = {
      _id: "book-1",
      availableCopies: 2,
      save: vi.fn().mockResolvedValue(undefined),
    };
    const session = { id: "session-1" };

    await promoteNextReservation(book, session);

    expect(reservation.status).toBe("approved");
    expect(reservation.pickupDeadline).toEqual(
      new Date("2026-01-13T12:00:00.000Z"),
    );
    expect(book.availableCopies).toBe(1);
    expect(reservation.save).toHaveBeenCalledWith({ session });
    expect(book.save).toHaveBeenCalledWith({ session });
  });
});
