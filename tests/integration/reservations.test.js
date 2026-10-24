import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import app from "../../app.js";
import Book from "../../models/book-model.js";
import Loan from "../../models/loan-model.js";
import RefreshToken from "../../models/refreshToken-model.js";
import Reservation from "../../models/reservation-model.js";
import User from "../../models/user-model.js";
import reservationService from "../../services/reservation-service.js";

const adminData = {
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.com",
  phone: "+12025550124",
  password: "password123",
  role: "admin",
};

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
  availableCopies: 1,
};

let mongo;

const originalAccessSecret = process.env.JWT_ACCESS_SECRET_KEY;
const originalRefreshSecret = process.env.JWT_REFRESH_SECRET_KEY;

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

const createUser = async (data = userData) => {
  const response = await request(app).post("/api/auth/register").send(data);
  expect(response.status).toBe(201);
  return response.body.data;
};

const createAdmin = async () => {
  await User.create(adminData);
  const response = await login(adminData.email, adminData.password);
  expect(response.status).toBe(200);
  return response.body.data;
};

const createBook = async (data = {}) => Book.create({ ...bookData, ...data });

const createReservation = (accessToken, bookId) =>
  request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ bookId });

const getReservations = (accessToken, query = {}) =>
  request(app)
    .get("/api/reservations")
    .set("Authorization", `Bearer ${accessToken}`)
    .query(query);

const getReservation = (accessToken, reservationId) =>
  request(app)
    .get(`/api/reservations/${reservationId}`)
    .set("Authorization", `Bearer ${accessToken}`);

const cancelReservation = (accessToken, reservationId) =>
  request(app)
    .patch(`/api/reservations/${reservationId}/cancel`)
    .set("Authorization", `Bearer ${accessToken}`);

const fulfillReservation = (accessToken, reservationId) =>
  request(app)
    .patch(`/api/reservations/${reservationId}/fulfill`)
    .set("Authorization", `Bearer ${accessToken}`);

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET_KEY = "test-access-secret";
  process.env.JWT_REFRESH_SECRET_KEY = "test-refresh-secret";

  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongo.getUri());
}, 30_000);

afterEach(async () => {
  await Promise.all([
    Reservation.deleteMany({}),
    Loan.deleteMany({}),
    Book.deleteMany({}),
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();

  if (originalAccessSecret === undefined) {
    delete process.env.JWT_ACCESS_SECRET_KEY;
  } else {
    process.env.JWT_ACCESS_SECRET_KEY = originalAccessSecret;
  }

  if (originalRefreshSecret === undefined) {
    delete process.env.JWT_REFRESH_SECRET_KEY;
  } else {
    process.env.JWT_REFRESH_SECRET_KEY = originalRefreshSecret;
  }
});

describe("reservations workflow", () => {
  describe("creation", () => {
    it("validates the book ID", async () => {
      const { accessToken } = await createUser();

      const response = await request(app)
        .post("/api/reservations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "bookId" })]),
      );
    });

    it("rejects a nonexistent or inactive book", async () => {
      const { accessToken } = await createUser();
      const missingResponse = await createReservation(
        accessToken,
        new mongoose.Types.ObjectId(),
      );
      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body.message).toBe("Book not found");

      const book = await createBook({ isActive: false });
      const inactiveResponse = await createReservation(accessToken, book._id);
      expect(inactiveResponse.status).toBe(400);
      expect(inactiveResponse.body.message).toBe(
        "Book is not available for reservation",
      );
    });

    it("approves a reservation and allocates an available copy", async () => {
      const { accessToken } = await createUser();
      const book = await createBook();

      const response = await createReservation(accessToken, book._id);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("approved");
      expect(response.body.data.pickupDeadline).toEqual(expect.any(String));
      expect((await Book.findById(book._id)).availableCopies).toBe(0);
    });

    it("creates a pending reservation when no copy is available", async () => {
      const { accessToken } = await createUser();
      const book = await createBook({ availableCopies: 0 });

      const response = await createReservation(accessToken, book._id);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("pending");
      expect(response.body.data.pickupDeadline).toBeUndefined();
      expect((await Book.findById(book._id)).availableCopies).toBe(0);
    });

    it("rejects when the book becomes unavailable during allocation", async () => {
      await createUser();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook({ availableCopies: 0 });
      const updateSpy = vi
        .spyOn(Book, "updateOne")
        .mockResolvedValue({ matchedCount: 0 });

      await expect(
        reservationService.createReservation(user._id, book._id),
      ).rejects.toMatchObject({
        message: "Book is not available for reservation",
        statusCode: 400,
      });

      expect(await Reservation.countDocuments({})).toBe(0);
      updateSpy.mockRestore();
    });

    it("rejects duplicate active reservations and active loans", async () => {
      const { accessToken } = await createUser();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook();

      const firstResponse = await createReservation(accessToken, book._id);
      expect(firstResponse.status).toBe(200);

      const duplicateResponse = await createReservation(accessToken, book._id);
      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.message).toBe(
        "You already have an active reservation for this book",
      );

      await Reservation.deleteMany({});
      await Loan.create({ userId: user._id, bookId: book._id });

      const loanResponse = await createReservation(accessToken, book._id);
      expect(loanResponse.status).toBe(400);
      expect(loanResponse.body.message).toBe(
        "You already have this book borrowed",
      );
    });
  });

  describe("listing and details", () => {
    it("returns only the current user's reservations", async () => {
      const { accessToken } = await createUser();
      const otherUser = await User.create({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const user = await User.findOne({ email: userData.email });
      await Reservation.create({ userId: user._id, bookId: book._id });
      await Reservation.create({ userId: otherUser._id, bookId: book._id });

      const response = await getReservations(accessToken);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user.email).toBe(userData.email);
      expect(response.body.data[0].book.title).toBe(bookData.title);
    });

    it("allows admins to filter all reservations", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook();
      await Reservation.create({
        userId: user._id,
        bookId: book._id,
        status: "pending",
      });

      const response = await getReservations(accessToken).query({
        status: "pending",
        limit: 1,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe("pending");
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it("rejects invalid reservation filters", async () => {
      const { accessToken } = await createUser();

      const response = await getReservations(accessToken, {
        status: "invalid",
        limit: 101,
      });

      expect(response.status).toBe(400);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it("restricts reservation details to the owner or an admin", async () => {
      const { accessToken } = await createUser();
      const otherUser = await User.create({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const reservation = await Reservation.create({
        userId: otherUser._id,
        bookId: book._id,
      });

      const forbiddenResponse = await getReservation(
        accessToken,
        reservation._id,
      );
      expect(forbiddenResponse.status).toBe(404);

      const { accessToken: adminToken } = await createAdmin();
      const adminResponse = await getReservation(adminToken, reservation._id);
      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.data.user.email).toBe("other@example.com");
    });
  });

  describe("cancellation", () => {
    it("cancels an approved reservation and restores availability", async () => {
      const { accessToken } = await createUser();
      const book = await createBook();
      const createResponse = await createReservation(accessToken, book._id);
      const reservationId = createResponse.body.data._id;

      const response = await cancelReservation(accessToken, reservationId);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("cancelled");
      expect((await Book.findById(book._id)).availableCopies).toBe(1);
    });

    it("allows an admin to cancel any user's reservation", async () => {
      const { accessToken: userToken } = await createUser();
      const { accessToken: adminToken } = await createAdmin();
      const book = await createBook();
      const createResponse = await createReservation(userToken, book._id);

      const response = await cancelReservation(
        adminToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("cancelled");
    });

    it("cancels a pending reservation without changing availability", async () => {
      const { accessToken } = await createUser();
      const book = await createBook({ availableCopies: 0 });
      const createResponse = await createReservation(accessToken, book._id);

      const response = await cancelReservation(
        accessToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("cancelled");
      expect((await Book.findById(book._id)).availableCopies).toBe(0);
    });

    it("promotes the next pending reservation when an approved one is cancelled", async () => {
      const { accessToken: firstToken } = await createUser();
      const nextUser = await User.create({
        ...userData,
        email: "next@example.com",
        phone: "+12025550126",
      });
      const nextLogin = await login("next@example.com", userData.password);
      const book = await createBook();

      const approvedResponse = await createReservation(firstToken, book._id);
      const pendingResponse = await createReservation(
        nextLogin.body.data.accessToken,
        book._id,
      );

      const cancelResponse = await cancelReservation(
        firstToken,
        approvedResponse.body.data._id,
      );

      expect(cancelResponse.status).toBe(200);
      const promoted = await Reservation.findById(
        pendingResponse.body.data._id,
      );
      expect(promoted.status).toBe("approved");
      expect(promoted.pickupDeadline).toEqual(expect.any(Date));
      expect((await Book.findById(book._id)).availableCopies).toBe(0);
      expect(nextUser).toBeDefined();
    });

    it("rejects cancellation of a fulfilled reservation", async () => {
      const { accessToken: userToken } = await createUser();
      const { accessToken: adminToken } = await createAdmin();
      const book = await createBook();
      const createResponse = await createReservation(userToken, book._id);

      await fulfillReservation(adminToken, createResponse.body.data._id);
      const response = await cancelReservation(
        userToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Only pending or approved reservations can be cancelled",
      );
    });

    it("returns 404 when cancelling another user's reservation", async () => {
      const { accessToken } = await createUser();
      const otherUser = await User.create({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const reservation = await Reservation.create({
        userId: otherUser._id,
        bookId: book._id,
      });

      const response = await cancelReservation(accessToken, reservation._id);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Reservation not found");
    });

    it("returns 404 when cancelling a reservation whose book is missing", async () => {
      const { accessToken } = await createUser();
      const book = await createBook();
      const createResponse = await createReservation(accessToken, book._id);
      await Book.deleteOne({ _id: book._id });

      const response = await cancelReservation(
        accessToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found for this reservation");
      expect(
        (await Reservation.findById(createResponse.body.data._id)).status,
      ).toBe("approved");
    });
  });

  describe("fulfillment", () => {
    it("allows only admins to fulfill a reservation", async () => {
      const { accessToken: userToken } = await createUser();
      const { accessToken: adminToken } = await createAdmin();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook();
      const createResponse = await createReservation(userToken, book._id);

      const forbiddenResponse = await fulfillReservation(
        userToken,
        createResponse.body.data._id,
      );
      expect(forbiddenResponse.status).toBe(403);

      const response = await fulfillReservation(
        adminToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.userId).toBe(user._id.toString());
      expect(await Loan.countDocuments({})).toBe(1);
      expect(
        (await Reservation.findById(createResponse.body.data._id)).status,
      ).toBe("fulfilled");
    });

    it("rejects fulfillment of a pending reservation", async () => {
      const { accessToken: userToken } = await createUser();
      const { accessToken: adminToken } = await createAdmin();
      const book = await createBook({ availableCopies: 0 });
      const createResponse = await createReservation(userToken, book._id);

      const response = await fulfillReservation(
        adminToken,
        createResponse.body.data._id,
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Only approved reservations can be fulfilled",
      );
      expect(await Loan.countDocuments({})).toBe(0);
    });

    it("returns 404 when fulfilling an unknown reservation", async () => {
      const { accessToken } = await createAdmin();

      const response = await fulfillReservation(
        accessToken,
        new mongoose.Types.ObjectId(),
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Reservation not found");
    });
  });
});
