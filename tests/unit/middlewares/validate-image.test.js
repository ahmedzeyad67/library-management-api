import { describe, expect, it, vi } from "vitest";
import { fileTypeFromBuffer } from "file-type";
import validateImage from "../../../middlewares/validate-image.js";

vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn(),
}));

describe("validateImage", () => {
  it("calls next when no file was uploaded", async () => {
    const next = vi.fn();

    await validateImage({}, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(fileTypeFromBuffer).not.toHaveBeenCalled();
  });

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts a valid %s image",
    async (mime) => {
      const buffer = Buffer.from("image data");
      fileTypeFromBuffer.mockResolvedValue({ mime });
      const next = vi.fn();

      await validateImage(
        { file: { buffer, mimetype: mime } },
        {},
        next,
      );

      expect(fileTypeFromBuffer).toHaveBeenCalledWith(buffer);
      expect(next).toHaveBeenCalledOnce();
    },
  );

  it("rejects unsupported image types", async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: "image/gif" });
    const next = vi.fn();

    await validateImage(
      { file: { buffer: Buffer.from("image data"), mimetype: "image/gif" } },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Only JPEG, PNG, and WebP images are allowed",
        statusCode: 400,
      }),
    );
  });

  it("rejects files whose MIME type does not match their content", async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: "image/png" });
    const next = vi.fn();

    await validateImage(
      { file: { buffer: Buffer.from("image data"), mimetype: "image/jpeg" } },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "File content does not match the file extension",
        statusCode: 400,
      }),
    );
  });

  it("forwards file-type detection errors", async () => {
    const error = new Error("Could not inspect file");
    fileTypeFromBuffer.mockRejectedValue(error);
    const next = vi.fn();

    await validateImage(
      { file: { buffer: Buffer.from("image data"), mimetype: "image/png" } },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});
