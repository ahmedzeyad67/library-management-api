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
import RefreshToken from "../../models/refreshToken-model.js";
import User from "../../models/user-model.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary-helper.js";

vi.mock("../../utils/cloudinary-helper.js", () => ({
  deleteFromCloudinary: vi.fn(),
  uploadToCloudinary: vi.fn(),
}));

const adminData = {
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.com",
  phone: "+12025550124",
  password: "password123",
  role: "admin",
};

const regularUserData = {
  firstName: "Regular",
  lastName: "User",
  email: "user@example.com",
  phone: "+12025550125",
  password: "password123",
};

const bookData = {
  title: "Clean Code",
  author: "Robert Martin",
  isbn: "9780132350884",
  category: "Programming",
  description: "A handbook of agile software craftsmanship.",
  publishedYear: 2008,
  totalCopies: 3,
};

const imageBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let mongo;

const originalAccessSecret = process.env.JWT_ACCESS_SECRET_KEY;
const originalRefreshSecret = process.env.JWT_REFRESH_SECRET_KEY;

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

const createBook = (accessToken, data = bookData) =>
  request(app)
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(data);

const createAdminToken = async () => {
  await User.create(adminData);

  const response = await login(adminData.email, adminData.password);

  expect(response.status).toBe(200);

  return response.body.data.accessToken;
};

const createRegularUserToken = async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send(regularUserData);

  expect(response.status).toBe(201);

  return response.body.data.accessToken;
};

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
    Book.deleteMany({}),
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  vi.restoreAllMocks();
  vi.resetAllMocks();
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

describe("books workflow", () => {
  describe("book creation", () => {
    it("requires an authenticated admin", async () => {
      const response = await request(app).post("/api/books").send(bookData);

      expect(response.status).toBe(401);
    });

    it("rejects a regular user", async () => {
      const accessToken = await createRegularUserToken();

      const response = await createBook(accessToken);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied");
    });

    it("rejects invalid book data", async () => {
      const accessToken = await createAdminToken();

      const response = await createBook(accessToken, {
        ...bookData,
        title: "A",
        isbn: "not-an-isbn",
        category: "Invalid category",
        description: "short",
        publishedYear: 999,
        totalCopies: 0,
      });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(expect.any(Array));
      expect(response.body.data.errors.length).toBeGreaterThan(0);
      expect(response.body.data.errors).toContainEqual({
        field: "isbn",
        message: "Invalid ISBN format",
      });
      expect(await Book.countDocuments({})).toBe(0);
    });

    it("creates a book with all copies available", async () => {
      const accessToken = await createAdminToken();

      const response = await createBook(accessToken);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: "success",
        data: {
          title: bookData.title,
          isbn: bookData.isbn,
          totalCopies: bookData.totalCopies,
          availableCopies: bookData.totalCopies,
          isActive: true,
        },
      });
    });

    it("rejects a duplicate ISBN", async () => {
      const accessToken = await createAdminToken();

      const firstResponse = await createBook(accessToken);

      expect(firstResponse.status).toBe(201);

      const response = await createBook(accessToken, {
        ...bookData,
        title: "Another Book",
        isbn: bookData.isbn,
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("isbn already exists");
      expect(await Book.countDocuments({})).toBe(1);
    });

    it("uploads and returns a cover image without exposing its public ID", async () => {
      const accessToken = await createAdminToken();

      uploadToCloudinary.mockResolvedValue({
        url: "https://cdn.example.com/book-cover.png",
        publicId: "cover-1",
      });

      const response = await request(app)
        .post("/api/books")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", bookData.title)
        .field("author", bookData.author)
        .field("isbn", bookData.isbn)
        .field("category", bookData.category)
        .field("description", bookData.description)
        .field("publishedYear", bookData.publishedYear)
        .field("totalCopies", bookData.totalCopies)
        .attach("coverImage", imageBuffer, {
          filename: "cover.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(201);
      expect(uploadToCloudinary).toHaveBeenCalledWith(expect.any(Buffer));
      expect(response.body.data.coverImage).toEqual({
        url: "https://cdn.example.com/book-cover.png",
      });

      const savedBook = await Book.findOne({ isbn: bookData.isbn })
        .select("+coverImage.publicId")
        .lean();

      expect(savedBook.coverImage.publicId).toBe("cover-1");
    });

    it("cleans up an uploaded cover when book persistence fails", async () => {
      const accessToken = await createAdminToken();

      await createBook(accessToken);

      uploadToCloudinary.mockResolvedValue({
        url: "https://cdn.example.com/duplicate.png",
        publicId: "duplicate-cover",
      });

      const response = await request(app)
        .post("/api/books")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", "Duplicate Cover Book")
        .field("author", bookData.author)
        .field("isbn", bookData.isbn)
        .field("category", bookData.category)
        .field("description", bookData.description)
        .field("publishedYear", bookData.publishedYear)
        .field("totalCopies", bookData.totalCopies)
        .attach("coverImage", imageBuffer, {
          filename: "cover.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(409);
      expect(deleteFromCloudinary).toHaveBeenCalledWith("duplicate-cover");
      expect(await Book.countDocuments({})).toBe(1);
    });

    it("does not fail the request when cleanup fails after persistence fails", async () => {
      const accessToken = await createAdminToken();

      await createBook(accessToken);

      uploadToCloudinary.mockResolvedValue({
        url: "https://cdn.example.com/duplicate.png",
        publicId: "duplicate-cover",
      });

      deleteFromCloudinary.mockRejectedValueOnce(new Error("Cloudinary down"));

      const response = await request(app)
        .post("/api/books")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", "Duplicate Cover Book")
        .field("author", bookData.author)
        .field("isbn", bookData.isbn)
        .field("category", bookData.category)
        .field("description", bookData.description)
        .field("publishedYear", bookData.publishedYear)
        .field("totalCopies", bookData.totalCopies)
        .attach("coverImage", imageBuffer, {
          filename: "cover.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("isbn already exists");
      expect(deleteFromCloudinary).toHaveBeenCalledWith("duplicate-cover");
      expect(await Book.countDocuments({})).toBe(1);
    });

    it("rejects a client-supplied availableCopies value", async () => {
      const accessToken = await createAdminToken();

      const response = await createBook(accessToken, {
        ...bookData,
        availableCopies: 99,
      });

      expect(response.status).toBe(400);
      expect(await Book.countDocuments({})).toBe(0);
    });
  });

  describe("book reads", () => {
    it("lists active books and supports search and pagination", async () => {
      const accessToken = await createAdminToken();

      await createBook(accessToken);

      await createBook(accessToken, {
        ...bookData,
        title: "The Pragmatic Programmer",
        isbn: "9780135957059",
      });

      const response = await request(app)
        .get("/api/books")
        .query({ search: "pragmatic", limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe("The Pragmatic Programmer");
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it("does not list inactive books for regular users", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      const deactivateResponse = await request(app)
        .patch(`/api/books/${bookId}/deactivate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deactivateResponse.status).toBe(200);

      const listResponse = await request(app).get("/api/books");

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toHaveLength(0);
    });

    it("returns 404 for a nonexistent book", async () => {
      const response = await request(app).get(
        `/api/books/${new mongoose.Types.ObjectId()}`,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("lists all books for an admin, including inactive books, allows direct lookup", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);

      await Book.updateOne(
        { _id: createResponse.body.data._id },
        { isActive: false },
      );

      const response = await request(app)
        .get("/api/books/admin")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ isActive: false, search: "Clean" });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(false);

      const bookId = response.body.data[0]._id;

      const detailResponse = await request(app).get(`/api/books/${bookId}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data._id).toBe(bookId);
      expect(detailResponse.body.data.isActive).toBe(false);
    });
  });

  describe("book updates", () => {
    it("updates fields and recalculates available copies", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      await Book.updateOne({ _id: bookId }, { availableCopies: 1 });

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Clean Code Updated", totalCopies: 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe("Clean Code Updated");
      expect(response.body.data.totalCopies).toBe(5);
      expect(response.body.data.availableCopies).toBe(3);
    });

    it("rejects reducing total copies below borrowed copies", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      await Book.updateOne({ _id: bookId }, { availableCopies: 1 });

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ totalCopies: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Total copies cannot be less than borrowed copies (2)",
      );
    });

    it("rejects an invalid ISBN during update", async () => {
      const accessToken = await createAdminToken();
      const createResponse = await createBook(accessToken);

      const response = await request(app)
        .patch(`/api/books/${createResponse.body.data._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ isbn: "not-an-isbn" });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toContainEqual({
        field: "isbn",
        message: "Invalid ISBN format",
      });
    });

    it("returns 404 when updating a nonexistent book", async () => {
      const accessToken = await createAdminToken();

      const response = await request(app)
        .patch(`/api/books/${new mongoose.Types.ObjectId()}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Updated Title" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("updates a cover image and deletes the old image", async () => {
      const accessToken = await createAdminToken();

      uploadToCloudinary.mockResolvedValueOnce({
        url: "https://cdn.example.com/old.png",
        publicId: "old-cover",
      });

      const createResponse = await request(app)
        .post("/api/books")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", bookData.title)
        .field("author", bookData.author)
        .field("isbn", bookData.isbn)
        .field("category", bookData.category)
        .field("description", bookData.description)
        .field("publishedYear", bookData.publishedYear)
        .field("totalCopies", bookData.totalCopies)
        .attach("coverImage", imageBuffer, {
          filename: "old.png",
          contentType: "image/png",
        });

      expect(createResponse.status).toBe(201);

      const bookId = createResponse.body.data._id;

      uploadToCloudinary.mockResolvedValueOnce({
        url: "https://cdn.example.com/new.png",
        publicId: "new-cover",
      });

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", "Clean Code Revised")
        .attach("coverImage", imageBuffer, {
          filename: "new.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.coverImage).toEqual({
        url: "https://cdn.example.com/new.png",
      });
      expect(deleteFromCloudinary).toHaveBeenCalledWith("old-cover");

      const savedBook = await Book.findById(bookId)
        .select("+coverImage.publicId")
        .lean();

      expect(savedBook.coverImage.publicId).toBe("new-cover");
    });

    it("cleans up a new cover when the update fails", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      uploadToCloudinary.mockResolvedValue({
        url: "https://cdn.example.com/new.png",
        publicId: "failed-update-cover",
      });

      deleteFromCloudinary.mockRejectedValueOnce(new Error("Cloudinary down"));

      vi.spyOn(Book, "findOneAndUpdate").mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", "Failed Update")
        .attach("coverImage", imageBuffer, {
          filename: "new.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Update failed, Please try again");
      expect(deleteFromCloudinary).toHaveBeenCalledWith("failed-update-cover");

      const savedBook = await Book.findById(bookId);

      expect(savedBook.title).toBe(bookData.title);
    });

    it("keeps the update successful when old-cover deletion fails", async () => {
      const accessToken = await createAdminToken();

      uploadToCloudinary.mockResolvedValueOnce({
        url: "https://cdn.example.com/old.png",
        publicId: "old-cover",
      });

      const createResponse = await request(app)
        .post("/api/books")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", bookData.title)
        .field("author", bookData.author)
        .field("isbn", bookData.isbn)
        .field("category", bookData.category)
        .field("description", bookData.description)
        .field("publishedYear", bookData.publishedYear)
        .field("totalCopies", bookData.totalCopies)
        .attach("coverImage", imageBuffer, {
          filename: "old.png",
          contentType: "image/png",
        });

      expect(createResponse.status).toBe(201);

      const bookId = createResponse.body.data._id;

      uploadToCloudinary.mockResolvedValueOnce({
        url: "https://cdn.example.com/new.png",
        publicId: "new-cover",
      });

      deleteFromCloudinary.mockRejectedValueOnce(new Error("Cloudinary down"));

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("title", "Updated Despite Cleanup Error")
        .attach("coverImage", imageBuffer, {
          filename: "new.png",
          contentType: "image/png",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe("Updated Despite Cleanup Error");
      expect(deleteFromCloudinary).toHaveBeenCalledWith("old-cover");

      const savedBook = await Book.findById(bookId)
        .select("+coverImage.publicId")
        .lean();

      expect(savedBook.coverImage.publicId).toBe("new-cover");
    });

    it("rejects manually changing managed fields", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ availableCopies: 99, isActive: false });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "",
            message: "availableCopies field cannot be set manually",
          }),
          expect.objectContaining({
            field: "",
            message: "isActive field cannot be set manually",
          }),
        ]),
      );
    });

    it("activates and deactivates a book as an admin", async () => {
      const accessToken = await createAdminToken();

      const createResponse = await createBook(accessToken);
      const bookId = createResponse.body.data._id;

      const deactivateResponse = await request(app)
        .patch(`/api/books/${bookId}/deactivate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deactivateResponse.status).toBe(200);
      expect(deactivateResponse.body.data.isActive).toBe(false);

      const activateResponse = await request(app)
        .patch(`/api/books/${bookId}/activate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(activateResponse.status).toBe(200);
      expect(activateResponse.body.data.isActive).toBe(true);
    });

    it("returns 404 when deactivating a nonexistent book", async () => {
      const accessToken = await createAdminToken();
      const bookId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/books/${bookId}/deactivate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("rejects a regular user attempting to update a book", async () => {
      const adminToken = await createAdminToken();

      const createResponse = await createBook(adminToken);
      const bookId = createResponse.body.data._id;

      const userToken = await createRegularUserToken();

      const response = await request(app)
        .patch(`/api/books/${bookId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Unauthorized Update" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied");
    });

    it("rejects a regular user attempting to change book status", async () => {
      const adminToken = await createAdminToken();

      const createResponse = await createBook(adminToken);
      const bookId = createResponse.body.data._id;

      const userToken = await createRegularUserToken();

      const response = await request(app)
        .patch(`/api/books/${bookId}/deactivate`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied");

      const savedBook = await Book.findById(bookId);

      expect(savedBook.isActive).toBe(true);
    });
  });
});
