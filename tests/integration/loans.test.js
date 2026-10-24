import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../../app.js";
import Book from "../../models/book-model.js";
import Loan from "../../models/loan-model.js";
import RefreshToken from "../../models/refreshToken-model.js";
import Reservation from "../../models/reservation-model.js";
import User from "../../models/user-model.js";

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
  availableCopies: 0,
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
  const user = await User.create(adminData);
  const response = await login(adminData.email, adminData.password);
  expect(response.status).toBe(200);
  return { ...response.body.data, user };
};

const createBook = async (data = {}) => Book.create({ ...bookData, ...data });

const createLoan = async ({ userId, bookId, data = {} }) =>
  Loan.create({ userId, bookId, ...data });

const getLoans = (accessToken, query = {}) =>
  request(app)
    .get("/api/loans")
    .set("Authorization", `Bearer ${accessToken}`)
    .query(query);

const getLoan = (accessToken, loanId) =>
  request(app)
    .get(`/api/loans/${loanId}`)
    .set("Authorization", `Bearer ${accessToken}`);

const returnLoan = (accessToken, loanId) =>
  request(app)
    .patch(`/api/loans/${loanId}/return`)
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
    Loan.deleteMany({}),
    Reservation.deleteMany({}),
    Book.deleteMany({}),
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);
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

describe("loans workflow", () => {
  describe("loan listing", () => {
    it("requires authentication", async () => {
      const response = await request(app).get("/api/loans");

      expect(response.status).toBe(401);
    });

    it("returns only the current user's loans", async () => {
      const { accessToken } = await createUser();
      const otherUser = await User.create({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const currentUser = await User.findOne({ email: userData.email });

      await createLoan({ userId: currentUser._id, bookId: book._id });
      await createLoan({ userId: otherUser._id, bookId: book._id });

      const response = await getLoans(accessToken);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user.email).toBe(userData.email);
      expect(response.body.data[0].book.title).toBe(bookData.title);
    });

    it("allows admins to search and filter all loans", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook();
      await createLoan({
        userId: user._id,
        bookId: book._id,
        data: { status: "overdue" },
      });

      const response = await getLoans(accessToken, {
        userSearch: "John Doe",
        bookSearch: "Clean",
        status: "overdue",
        limit: 1,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        status: "overdue",
        user: { email: userData.email },
        book: { title: bookData.title },
      });
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it("filters loans by borrowed and returned dates", async () => {
      const { accessToken } = await createUser();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook();
      await createLoan({
        userId: user._id,
        bookId: book._id,
        data: {
          borrowedAt: new Date("2026-10-23T10:00:00.000Z"),
          returnedAt: new Date("2026-10-24T10:00:00.000Z"),
        },
      });

      const response = await getLoans(accessToken, {
        borrowedAt: "2026-10-23",
        returnedAt: "2026-10-24",
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it("rejects invalid loan filters", async () => {
      const { accessToken } = await createUser();

      const response = await getLoans(accessToken, {
        status: "invalid",
        userSearch: " ",
        borrowedAt: "2026-99-99",
      });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(expect.any(Array));
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe("loan details", () => {
    it("allows a user to view their own loan", async () => {
      const { accessToken } = await createUser();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook();
      const loan = await createLoan({ userId: user._id, bookId: book._id });

      const response = await getLoan(accessToken, loan._id);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.book.isbn).toBe(bookData.isbn);
    });

    it("allows an admin to view any loan", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook();
      const loan = await createLoan({ userId: user._id, bookId: book._id });

      const response = await getLoan(accessToken, loan._id);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it("prevents a user from viewing another user's loan", async () => {
      const { accessToken } = await createUser();
      const otherUser = await User.create({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const loan = await createLoan({
        userId: otherUser._id,
        bookId: book._id,
      });

      const response = await getLoan(accessToken, loan._id);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Loan not found");
    });

    it("returns 404 for an unknown loan", async () => {
      const { accessToken } = await createUser();

      const response = await getLoan(
        accessToken,
        new mongoose.Types.ObjectId(),
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Loan not found");
    });
  });

  describe("loan returns", () => {
    it("allows only admins to return a loan", async () => {
      const { accessToken: userToken } = await createUser();
      const { user: admin, accessToken: adminToken } = await createAdmin();
      const user = await User.findOne({ email: userData.email });
      const book = await createBook();
      const loan = await createLoan({ userId: user._id, bookId: book._id });

      const userResponse = await returnLoan(userToken, loan._id);
      expect(userResponse.status).toBe(403);

      const adminResponse = await returnLoan(adminToken, loan._id);
      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.data.status).toBe("returned");
      expect(admin).toBeDefined();
    });

    it("returns a loan, calculates a fine, and restores book availability", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook();
      const loan = await createLoan({
        userId: user._id,
        bookId: book._id,
        data: { dueDate: new Date("2020-01-01T00:00:00.000Z") },
      });

      const response = await returnLoan(accessToken, loan._id);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("returned");
      expect(response.body.data.returnedAt).toEqual(expect.any(String));
      expect(response.body.data.fine).toBeGreaterThan(0);
      expect((await Book.findById(book._id)).availableCopies).toBe(1);
    });

    it("promotes a pending reservation during a return transaction", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const nextUser = await User.create({
        ...userData,
        email: "next@example.com",
        phone: "+12025550126",
      });
      const book = await createBook();
      const loan = await createLoan({ userId: user._id, bookId: book._id });
      const reservation = await Reservation.create({
        userId: nextUser._id,
        bookId: book._id,
        status: "pending",
      });

      const response = await returnLoan(accessToken, loan._id);

      expect(response.status).toBe(200);
      const updatedReservation = await Reservation.findById(reservation._id);
      expect(updatedReservation.status).toBe("approved");
      expect(updatedReservation.pickupDeadline).toEqual(expect.any(Date));
      expect((await Book.findById(book._id)).availableCopies).toBe(0);
    });

    it("rejects returning an already returned loan", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook({ availableCopies: 1 });
      const loan = await createLoan({
        userId: user._id,
        bookId: book._id,
        data: { status: "returned", returnedAt: new Date() },
      });

      const response = await returnLoan(accessToken, loan._id);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Loan has already been returned");
    });

    it("preserves the loan when its book is missing", async () => {
      const { accessToken } = await createAdmin();
      const user = await User.create(userData);
      const book = await createBook();
      const loan = await createLoan({ userId: user._id, bookId: book._id });
      await Book.deleteOne({ _id: book._id });

      const response = await returnLoan(accessToken, loan._id);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found for this loan");
      expect((await Loan.findById(loan._id)).status).toBe("borrowed");
    });

    it("returns 404 for an unknown loan", async () => {
      const { accessToken } = await createAdmin();

      const response = await returnLoan(
        accessToken,
        new mongoose.Types.ObjectId(),
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Loan not found");
    });
  });
});
