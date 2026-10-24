import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../../../models/user-model.js";
import { authenticate, authorize } from "../../../middlewares/auth.js";
import { verifyAccessToken } from "../../../utils/jwt-verification.js";

vi.mock("../../../models/user-model.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../utils/jwt-verification.js", () => ({
  verifyAccessToken: vi.fn(),
}));

const waitForMiddleware = () => new Promise((resolve) => setImmediate(resolve));

describe("authenticate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a Bearer token", async () => {
    const next = vi.fn();

    authenticate({ headers: {} }, {}, next);
    await waitForMiddleware();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unauthorized: Missing or invalid token",
        statusCode: 401,
      }),
    );
  });

  it("rejects requests for inactive or missing users", async () => {
    verifyAccessToken.mockReturnValue({ id: "user-1", role: "user" });
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });
    const next = vi.fn();

    authenticate(
      { headers: { authorization: "Bearer valid-token" } },
      {},
      next,
    );
    await waitForMiddleware();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Account is inactive or does not exist",
        statusCode: 401,
      }),
    );
  });

  it("sets the decoded user and calls next for an active user", async () => {
    const decodedUser = { id: "user-1", role: "user" };
    verifyAccessToken.mockReturnValue(decodedUser);
    const select = vi.fn().mockResolvedValue({ isActive: true });
    User.findById.mockReturnValue({ select });
    const request = {
      headers: { authorization: "Bearer valid-token" },
    };
    const next = vi.fn();

    authenticate(request, {}, next);
    await waitForMiddleware();

    expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
    expect(User.findById).toHaveBeenCalledWith("user-1");
    expect(select).toHaveBeenCalledWith("isActive");
    expect(request.user).toBe(decodedUser);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("authorize", () => {
  it("calls next when the user has an allowed role", () => {
    const next = vi.fn();

    authorize("admin")({ user: { role: "admin" } }, {}, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("throws an access denied error for a disallowed role", () => {
    expect(() => authorize("admin")({ user: { role: "user" } }, {}, vi.fn()))
      .toThrow(
        expect.objectContaining({
          message: "Access denied",
          statusCode: 403,
        }),
      );
  });
});
