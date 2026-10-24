import { describe, expect, it, vi } from "vitest";
import errorHandler from "../../../middlewares/error-handler.js";

const createResponse = () => {
  const json = vi.fn();
  const response = {
    status: vi.fn().mockReturnValue({ json }),
  };

  return { response, json };
};

describe("errorHandler", () => {
  it("converts Mongoose CastError to a 400 response", () => {
    const { response, json } = createResponse();

    errorHandler({ name: "CastError" }, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: "fail",
      message: "Invalid ID",
    });
  });

  it("converts Mongoose ValidationError to a 400 response", () => {
    const { response, json } = createResponse();
    const error = {
      name: "ValidationError",
      errors: {
        title: { message: "Title is required" },
        author: { message: "Author is required" },
      },
    };

    errorHandler(error, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: "fail",
      message: "Title is required, Author is required",
    });
  });

  it("converts duplicate-key errors to a 409 response", () => {
    const { response, json } = createResponse();

    errorHandler(
      { code: 11000, keyValue: { email: "john@example.com" } },
      {},
      response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      status: "fail",
      message: "email already exists",
    });
  });

  it("returns a 500 response for unexpected errors", () => {
    const { response, json } = createResponse();

    errorHandler(new Error("Unexpected failure"), {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      status: "error",
      message: "Unexpected failure",
    });
  });
});
