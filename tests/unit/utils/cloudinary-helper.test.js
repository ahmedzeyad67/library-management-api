import { describe, expect, it, vi } from "vitest";
import cloudinary from "../../../config/cloudinary.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../../utils/cloudinary-helper.js";

vi.mock("../../../config/cloudinary.js", () => ({
  default: {
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

describe("uploadToCloudinary", () => {
  it("uploads the buffer and returns the public image fields", async () => {
    const stream = { end: vi.fn() };
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
      callback(null, {
        secure_url: "https://cdn.example.com/cover.jpg",
        public_id: "cover-123",
      });
      return stream;
    });

    const buffer = Buffer.from("image data");
    const result = await uploadToCloudinary(buffer);

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      {
        folder: "library-management-system/book-covers",
        resource_type: "image",
      },
      expect.any(Function),
    );
    expect(stream.end).toHaveBeenCalledWith(buffer);
    expect(result).toEqual({
      url: "https://cdn.example.com/cover.jpg",
      publicId: "cover-123",
    });
  });

  it("rejects when Cloudinary returns an upload error", async () => {
    const error = new Error("Upload failed");
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
      const stream = { end: vi.fn() };
      callback(error);
      return stream;
    });

    await expect(uploadToCloudinary(Buffer.from("image data"))).rejects.toBe(
      error,
    );
  });
});

describe("deleteFromCloudinary", () => {
  it("deletes an image as an image resource", async () => {
    cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

    await expect(deleteFromCloudinary("cover-123")).resolves.toEqual({
      result: "ok",
    });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("cover-123", {
      resource_type: "image",
    });
  });
});
