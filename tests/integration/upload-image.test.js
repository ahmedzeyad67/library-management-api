import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import uploadImage from "../../middlewares/upload-image.js";
import errorHandler from "../../middlewares/error-handler.js";

const createApp = () => {
  const app = express();

  app.post("/upload", uploadImage, (req, res) => {
    res.json({
      fieldname: req.file.fieldname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  });
  app.use(errorHandler);

  return app;
};

describe("uploadImage", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts %s files",
    async (mimetype) => {
      const response = await request(createApp())
        .post("/upload")
        .attach("coverImage", Buffer.from("image data"), {
          filename: "cover",
          contentType: mimetype,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        fieldname: "coverImage",
        mimetype,
      });
    },
  );

  it("rejects unsupported file types", async () => {
    const response = await request(createApp())
      .post("/upload")
      .attach("coverImage", Buffer.from("text data"), {
        filename: "cover.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "fail",
      message: "Only JPEG, PNG, and WebP images are allowed",
    });
  });
});
