import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../../app.js";
import RefreshToken from "../../models/refreshToken-model.js";
import User from "../../models/user-model.js";
import userService from "../../services/user-service.js";

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

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET_KEY = "test-access-secret";
  process.env.JWT_REFRESH_SECRET_KEY = "test-refresh-secret";

  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongo.getUri());
}, 30_000);

afterEach(async () => {
  await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({})]);
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

describe("users workflow", () => {
  describe("admin user listing", () => {
    it("rejects a non-admin user", async () => {
      const { accessToken } = await createUser();

      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied");
    });

    it("lists users with name, email, phone, role, and status filters", async () => {
      const { accessToken } = await createAdmin();
      await createUser();
      await createUser({
        ...userData,
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "+12025550126",
      });

      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ search: "Jane Smith", role: "user", isActive: true });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        role: "user",
        isActive: true,
      });
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it("supports email and phone search", async () => {
      const { accessToken } = await createAdmin();
      await createUser();

      const emailResponse = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ search: "john@example.com" });
      expect(emailResponse.status).toBe(200);
      expect(emailResponse.body.data).toHaveLength(1);

      const phoneResponse = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ search: "12025550123" });
      expect(phoneResponse.status).toBe(200);
      expect(phoneResponse.body.data).toHaveLength(1);
    });

    it("validates listing filters and pagination", async () => {
      const { accessToken } = await createAdmin();

      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ search: " ", role: "owner", isActive: "maybe", limit: 101 });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(expect.any(Array));
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe("self update", () => {
    it("returns not found when updating a nonexistent user directly", async () => {
      await expect(
        userService.updateMe(new mongoose.Types.ObjectId(), {
          firstName: "Missing",
        }),
      ).rejects.toMatchObject({
        message: "User not found",
        statusCode: 404,
      });
    });

    it("does not rehash the password when saving another field", async () => {
      await createUser();
      const user = await User.findOne({ email: userData.email }).select(
        "+password",
      );
      const originalPasswordHash = user.password;

      user.firstName = "Johnny";
      await user.save();

      expect(user.password).toBe(originalPasswordHash);
      expect(
        (await User.findOne({ email: userData.email }).select("+password"))
          .password,
      ).toBe(originalPasswordHash);
    });

    it("updates allowed profile fields and trims values", async () => {
      const { accessToken } = await createUser();

      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ firstName: "  Johnny  ", lastName: "  Doe-Smith  " });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toMatchObject({
        firstName: "Johnny",
        lastName: "Doe-Smith",
      });

      const user = await User.findOne({ email: userData.email });
      expect(user.firstName).toBe("Johnny");
      expect(user.lastName).toBe("Doe-Smith");
    });

    it("rejects empty and unknown fields in self updates", async () => {
      const { accessToken } = await createUser();

      const emptyResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});
      expect(emptyResponse.status).toBe(400);

      const unknownResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "admin" });
      expect(unknownResponse.status).toBe(400);
      expect(unknownResponse.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message:
              "Only firstName, lastName, email, and phone fields are allowed",
          }),
        ]),
      );
    });

    it("rejects invalid self-update data", async () => {
      const { accessToken } = await createUser();

      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ firstName: "J", email: "invalid-email", phone: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it("rejects duplicate email and phone updates", async () => {
      const { accessToken } = await createUser();
      await createUser({
        ...userData,
        email: "other@example.com",
        phone: "+12025550126",
      });

      const emailResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "other@example.com" });
      expect(emailResponse.status).toBe(409);
      expect(emailResponse.body.message).toBe("email already exists");

      const phoneResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ phone: "+12025550126" });
      expect(phoneResponse.status).toBe(409);
      expect(phoneResponse.body.message).toBe("phone already exists");
    });
  });

  describe("user status management", () => {
    it("deactivates and reactivates a user through the admin workflow", async () => {
      const { accessToken: userToken } = await createUser();
      const { accessToken: adminToken } = await createAdmin();
      const user = await User.findOne({ email: userData.email });

      const deactivateResponse = await request(app)
        .patch(`/api/users/${user._id}/deactivate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deactivateResponse.status).toBe(200);
      expect(deactivateResponse.body.data.isActive).toBe(false);

      const blockedResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ firstName: "Blocked" });
      expect(blockedResponse.status).toBe(401);

      const activateResponse = await request(app)
        .patch(`/api/users/${user._id}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(activateResponse.status).toBe(200);
      expect(activateResponse.body.data.isActive).toBe(true);
    });

    it("rejects status changes by a regular user", async () => {
      const { accessToken: userToken } = await createUser();
      const target = await User.findOne({ email: userData.email });

      const response = await request(app)
        .patch(`/api/users/${target._id}/deactivate`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it("returns 404 for a nonexistent user status change", async () => {
      const { accessToken } = await createAdmin();
      const userId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/users/${userId}/deactivate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("returns 400 for an invalid user ID", async () => {
      const { accessToken } = await createAdmin();

      const response = await request(app)
        .patch("/api/users/not-an-id/deactivate")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid ID");
    });
  });
});
