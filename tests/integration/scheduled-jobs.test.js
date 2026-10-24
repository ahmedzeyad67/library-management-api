import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import startScheduledJobs from "../../jobs/scheduled-jobs.js";
import scheduledJobsService from "../../services/scheduled-jobs-service.js";
import Book from "../../models/book-model.js";
import Loan from "../../models/loan-model.js";
import RefreshToken from "../../models/refreshToken-model.js";
import Reservation from "../../models/reservation-model.js";
import User from "../../models/user-model.js";

const { scheduledCallbacks } = vi.hoisted(() => ({ scheduledCallbacks: [] }));

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn((expression, callback) => {
      scheduledCallbacks.push({ expression, callback });
      return { stop: vi.fn() };
    }),
  },
}));

const userData = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+12025550123",
  password: "password123",
};

const bookData = {
  title: "Clean Code",
  author: "Robert Martin",
  isbn: "9780132350884",
  category: "Programming",
  description: "A handbook of agile software craftsmanship.",
  publishedYear: 2008,
  totalCopies: 1,
  availableCopies: 0,
};

let mongo;

const createUser = (data = userData) => User.create(data);
const createBook = (data = {}) => Book.create({ ...bookData, ...data });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongo.getUri());
}, 30_000);

beforeEach(() => {
  scheduledCallbacks.length = 0;
  vi.restoreAllMocks();
});

afterEach(async () => {
  await Promise.all([
    Reservation.deleteMany({}),
    Loan.deleteMany({}),
    Book.deleteMany({}),
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("scheduled job service", () => {
  it("expires an overdue approved reservation and restores availability", async () => {
    const user = await createUser();
    const book = await createBook();
    const reservation = await Reservation.create({
      userId: user._id,
      bookId: book._id,
      status: "approved",
      pickupDeadline: new Date("2020-01-01T00:00:00.000Z"),
    });

    const expiredCount = await scheduledJobsService.expireReservations();

    expect(expiredCount).toBe(1);
    expect((await Reservation.findById(reservation._id)).status).toBe(
      "expired",
    );
    expect((await Book.findById(book._id)).availableCopies).toBe(1);
  });

  it("promotes the oldest pending reservation after expiration", async () => {
    const firstUser = await createUser();
    const nextUser = await createUser({
      ...userData,
      email: "next@example.com",
      phone: "+12025550126",
    });
    const book = await createBook();
    const expiredReservation = await Reservation.create({
      userId: firstUser._id,
      bookId: book._id,
      status: "approved",
      pickupDeadline: new Date("2020-01-01T00:00:00.000Z"),
    });
    const pendingReservation = await Reservation.create({
      userId: nextUser._id,
      bookId: book._id,
      status: "pending",
      reservedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    await scheduledJobsService.expireReservations();

    expect((await Reservation.findById(expiredReservation._id)).status).toBe(
      "expired",
    );
    const promoted = await Reservation.findById(pendingReservation._id);
    expect(promoted.status).toBe("approved");
    expect(promoted.pickupDeadline).toEqual(expect.any(Date));
    expect((await Book.findById(book._id)).availableCopies).toBe(0);
  });

  it("ignores future and non-approved reservations", async () => {
    const user = await createUser();
    const pendingUser = await createUser({
      ...userData,
      email: "pending@example.com",
      phone: "+12025550126",
    });
    const book = await createBook();
    await Reservation.create([
      {
        userId: pendingUser._id,
        bookId: book._id,
        status: "approved",
        pickupDeadline: new Date("2099-01-01T00:00:00.000Z"),
      },
      {
        userId: user._id,
        bookId: book._id,
        status: "pending",
        pickupDeadline: new Date("2020-01-01T00:00:00.000Z"),
      },
    ]);

    const expiredCount = await scheduledJobsService.expireReservations();

    expect(expiredCount).toBe(0);
    expect((await Book.findById(book._id)).availableCopies).toBe(0);
  });

  it("rolls back expiration when the related book is missing", async () => {
    const user = await createUser();
    const book = await createBook();
    const reservation = await Reservation.create({
      userId: user._id,
      bookId: book._id,
      status: "approved",
      pickupDeadline: new Date("2020-01-01T00:00:00.000Z"),
    });
    await Book.deleteOne({ _id: book._id });

    await expect(
      scheduledJobsService.expireReservations(),
    ).rejects.toMatchObject({
      message: "Book not found for the expired reservation",
      statusCode: 404,
    });
    expect((await Reservation.findById(reservation._id)).status).toBe(
      "approved",
    );
  });

  it("ignores a reservation already changed before expiration commits", async () => {
    const user = await createUser();
    const book = await createBook();
    const reservation = await Reservation.create({
      userId: user._id,
      bookId: book._id,
      status: "approved",
      pickupDeadline: new Date("2020-01-01T00:00:00.000Z"),
    });
    const updateSpy = vi
      .spyOn(Reservation, "findOneAndUpdate")
      .mockResolvedValue(null);

    await expect(scheduledJobsService.expireReservations()).resolves.toBe(0);
    expect((await Reservation.findById(reservation._id)).status).toBe(
      "approved",
    );
    updateSpy.mockRestore();
  });

  it("marks only overdue borrowed loans as overdue", async () => {
    const user = await createUser();
    const overdueBook = await createBook();
    const futureBook = await createBook({ isbn: "9780135957059" });
    const returnedBook = await createBook({ isbn: "9780306406157" });
    const overdueLoan = await Loan.create({
      userId: user._id,
      bookId: overdueBook._id,
      status: "borrowed",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
    });
    const futureLoan = await Loan.create({
      userId: user._id,
      bookId: futureBook._id,
      status: "borrowed",
      dueDate: new Date("2099-01-01T00:00:00.000Z"),
    });
    const returnedLoan = await Loan.create({
      userId: user._id,
      bookId: returnedBook._id,
      status: "returned",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
    });

    const overdueCount = await scheduledJobsService.markOverdueLoans();

    expect(overdueCount).toBe(1);
    expect((await Loan.findById(overdueLoan._id)).status).toBe("overdue");
    expect((await Loan.findById(futureLoan._id)).status).toBe("borrowed");
    expect((await Loan.findById(returnedLoan._id)).status).toBe("returned");
  });
});

describe("scheduled job registration", () => {
  it("registers reservation and loan jobs every minute", () => {
    startScheduledJobs();

    expect(scheduledCallbacks).toHaveLength(2);
    expect(scheduledCallbacks.map(({ expression }) => expression)).toEqual([
      "* * * * *",
      "* * * * *",
    ]);
  });

  it("runs both callbacks and logs changed counts", async () => {
    vi.spyOn(scheduledJobsService, "expireReservations").mockResolvedValue(2);
    vi.spyOn(scheduledJobsService, "markOverdueLoans").mockResolvedValue(3);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    startScheduledJobs();
    await scheduledCallbacks[0].callback();
    await scheduledCallbacks[1].callback();

    expect(logSpy).toHaveBeenCalledWith("Expired reservations: 2");
    expect(logSpy).toHaveBeenCalledWith("Marked overdue loans: 3");
  });

  it("does not log when scheduled jobs change nothing", async () => {
    vi.spyOn(scheduledJobsService, "expireReservations").mockResolvedValue(0);
    vi.spyOn(scheduledJobsService, "markOverdueLoans").mockResolvedValue(0);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    startScheduledJobs();
    await scheduledCallbacks[0].callback();
    await scheduledCallbacks[1].callback();

    expect(logSpy).toHaveBeenCalledWith("Scheduled jobs started");
    expect(logSpy).not.toHaveBeenCalledWith("Expired reservations: 0");
    expect(logSpy).not.toHaveBeenCalledWith("Marked overdue loans: 0");
  });

  it("logs failures without rejecting the scheduled callbacks", async () => {
    const reservationError = new Error("Reservation job failed");
    const loanError = new Error("Loan job failed");
    vi.spyOn(scheduledJobsService, "expireReservations").mockRejectedValue(
      reservationError,
    );
    vi.spyOn(scheduledJobsService, "markOverdueLoans").mockRejectedValue(
      loanError,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    startScheduledJobs();
    await expect(scheduledCallbacks[0].callback()).resolves.toBeUndefined();
    await expect(scheduledCallbacks[1].callback()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "Reservation expiration job failed:",
      reservationError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Overdue loan marking job failed:",
      loanError,
    );
  });
});
