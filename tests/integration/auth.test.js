import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import RefreshToken from "../../models/refreshToken-model.js";
import User from "../../models/user-model.js";

const userData = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+12025550123",
  password: "password123",
};

let mongo;
let originalAccessSecret;
let originalRefreshSecret;

const register = (data = userData) =>
  request(app).post("/api/auth/register").send(data);

const login = (email = userData.email, password = userData.password) =>
  request(app).post("/api/auth/login").send({ email, password });

const refresh = (refreshToken) =>
  request(app).post("/api/auth/refresh").send({ refreshToken });

const logout = (refreshToken) =>
  request(app).post("/api/auth/logout").send({ refreshToken });

const changePassword = (accessToken, currentPassword, newPassword) =>
  request(app)
    .patch("/api/auth/change-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ currentPassword, newPassword });

const registerAndGetTokens = async () => {
  const response = await register();

  expect(response.status).toBe(201);
  expect(response.body.data.accessToken).toEqual(expect.any(String));
  expect(response.body.data.refreshToken).toEqual(expect.any(String));

  return response.body.data;
};

beforeAll(async () => {
  originalAccessSecret = process.env.JWT_ACCESS_SECRET_KEY;
  originalRefreshSecret = process.env.JWT_REFRESH_SECRET_KEY;

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

describe("authentication workflow", () => {
  describe("registration", () => {
    it("validates required registration fields", async () => {
      const response = await request(app).post("/api/auth/register").send({});

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "firstName" }),
          expect.objectContaining({ field: "lastName" }),
          expect.objectContaining({ field: "email" }),
          expect.objectContaining({ field: "phone" }),
          expect.objectContaining({ field: "password" }),
        ]),
      );
    });

    it("rejects invalid registration data", async () => {
      const response = await register({
        ...userData,
        firstName: "J",
        lastName: "D",
        email: "not-an-email",
        phone: "not-a-phone",
        password: "123",
      });

      expect(response.status).toBe(400);
      expect(response.body.data.errors).toEqual(expect.any(Array));
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it("registers a user and returns access and refresh tokens", async () => {
      const response = await register();

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));

      const user = await User.findOne({ email: userData.email }).select(
        "+password",
      );

      expect(user).not.toBeNull();
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe("user");
      expect(user.password).not.toBe(userData.password);

      const storedTokens = await RefreshToken.find({ userId: user._id });

      expect(storedTokens).toHaveLength(1);
      expect(storedTokens[0].token).not.toBe(response.body.data.refreshToken);
      expect(storedTokens[0].token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("rejects registration with an existing email", async () => {
      const firstResponse = await register();
      expect(firstResponse.status).toBe(201);

      const response = await register({
        ...userData,
        phone: "+12025550124",
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("email already exists");
      expect(await User.countDocuments({})).toBe(1);
      expect(await RefreshToken.countDocuments({})).toBe(1);
    });

    it("rejects registration with an existing phone number", async () => {
      const firstResponse = await register();
      expect(firstResponse.status).toBe(201);

      const response = await register({
        ...userData,
        email: "another@example.com",
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("phone already exists");
      expect(await User.countDocuments({})).toBe(1);
      expect(await RefreshToken.countDocuments({})).toBe(1);
    });
  });

  describe("login", () => {
    it("logs in with valid credentials", async () => {
      await register();

      const response = await login();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
    });

    it("rejects an incorrect password", async () => {
      await register();

      const response = await login(userData.email, "wrong-password");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects login for an inactive user", async () => {
      await register();
      await User.updateOne({ email: userData.email }, { isActive: false });

      const response = await login();

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Your account is inactive. Contact the administrator.",
      );
    });

    it("rejects a nonexistent user", async () => {
      const response = await login("missing@example.com", userData.password);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });
  });

  describe("authenticated profile", () => {
    it("returns the authenticated user's profile", async () => {
      const { accessToken } = await registerAndGetTokens();

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.firstName).toBe(userData.firstName);
      expect(response.body.data).not.toHaveProperty("password");
    });

    it("rejects a request when the authenticated user no longer exists", async () => {
      const { accessToken } = await registerAndGetTokens();

      await User.deleteOne({ email: userData.email });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Account is inactive or does not exist",
      );
    });
  });

  describe("refresh tokens", () => {
    it("rotates a refresh token and invalidates the old token", async () => {
      const { refreshToken: oldRefreshToken } = await registerAndGetTokens();

      const response = await refresh(oldRefreshToken);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));

      const newRefreshToken = response.body.data.refreshToken;

      expect(newRefreshToken).not.toBe(oldRefreshToken);

      const replayResponse = await refresh(oldRefreshToken);

      expect(replayResponse.status).toBe(401);
      expect(replayResponse.body.message).toBe("Invalid refresh token");

      const storedTokens = await RefreshToken.find({});

      expect(storedTokens).toHaveLength(1);
      expect(storedTokens[0].token).not.toBe(newRefreshToken);
      expect(storedTokens[0].token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("rejects a malformed refresh token", async () => {
      const response = await refresh("not-a-valid-jwt");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid refresh token");
    });

    it("rejects an expired refresh token", async () => {
      const expiredToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString() },
        process.env.JWT_REFRESH_SECRET_KEY,
        { expiresIn: -1 },
      );

      const response = await refresh(expiredToken);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid refresh token");
    });

    it("preserves the refresh token when an inactive user refresh is rejected", async () => {
      const { refreshToken } = await registerAndGetTokens();

      await User.updateOne({ email: userData.email }, { isActive: false });

      const response = await refresh(refreshToken);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Account is inactive or does not exist",
      );
      expect(await RefreshToken.countDocuments({})).toBe(1);

      await User.updateOne({ email: userData.email }, { isActive: true });

      const retryResponse = await refresh(refreshToken);

      expect(retryResponse.status).toBe(200);
    });
  });

  describe("logout", () => {
    it("removes the refresh token and prevents it from being reused", async () => {
      const { refreshToken } = await registerAndGetTokens();

      const response = await logout(refreshToken);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data).toBeNull();

      expect(await RefreshToken.countDocuments({})).toBe(0);

      const refreshResponse = await refresh(refreshToken);

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.message).toBe("Invalid refresh token");
    });
  });

  describe("password changes", () => {
    it("changes the password and invalidates existing refresh tokens", async () => {
      const { accessToken, refreshToken } = await registerAndGetTokens();

      const response = await changePassword(
        accessToken,
        userData.password,
        "newPassword123",
      );

      expect(response.status).toBe(200);

      const oldPasswordLogin = await login(userData.email, userData.password);

      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await login(userData.email, "newPassword123");

      expect(newPasswordLogin.status).toBe(200);
      expect(newPasswordLogin.body.data.accessToken).toEqual(
        expect.any(String),
      );

      const oldRefreshResponse = await refresh(refreshToken);

      expect(oldRefreshResponse.status).toBe(401);
      expect(oldRefreshResponse.body.message).toBe("Invalid refresh token");
    });

    it("rejects a password change with an incorrect current password", async () => {
      const { accessToken } = await registerAndGetTokens();

      const response = await changePassword(
        accessToken,
        "incorrect-current-password",
        "newPassword123",
      );

      expect(response.status).toBe(401);
    });

    it("rejects a password change when the new password is too short", async () => {
      const { accessToken } = await registerAndGetTokens();

      const response = await changePassword(
        accessToken,
        userData.password,
        "short",
      );

      expect(response.status).toBe(400);
    });

    it("rejects a password change when the user no longer exists", async () => {
      const { accessToken } = await registerAndGetTokens();

      await User.deleteOne({ email: userData.email });

      const response = await changePassword(
        accessToken,
        userData.password,
        "newPassword123",
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Account is inactive or does not exist",
      );
    });
  });
});

describe("application routing", () => {
  it("returns a 404 response for an unknown route", async () => {
    const response = await request(app).get("/api/not-a-real-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: "error",
      message: "Route not found",
    });
  });
});
