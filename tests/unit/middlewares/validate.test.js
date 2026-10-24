import { describe, expect, it, vi } from "vitest";
import { validationResult } from "express-validator";
import validate from "../../../middlewares/validate.js";

vi.mock("express-validator", () => ({
  validationResult: vi.fn(),
}));

describe("validate", () => {
  it("calls next when there are no validation errors", () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
    });
    const next = vi.fn();

    validate({}, {}, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns a 400 response with formatted validation errors", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: "email", msg: "Please enter a valid email", value: "bad" },
        { path: "password", msg: "Password is required" },
      ],
    });
    const json = vi.fn();
    const response = {
      status: vi.fn().mockReturnValue({ json }),
    };
    const next = vi.fn();

    validate({}, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: "fail",
      data: {
        errors: [
          { field: "email", message: "Please enter a valid email" },
          { field: "password", message: "Password is required" },
        ],
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
