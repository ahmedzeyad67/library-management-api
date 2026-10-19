import multer from "multer";
import AppError from "../utils/app-error.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new AppError("Only JPEG, PNG, and WebP images are allowed", 400),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export default upload.single("coverImage");
