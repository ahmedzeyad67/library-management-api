import { fileTypeFromBuffer } from "file-type";
import AppError from "../utils/app-error.js";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

const validateImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const fileType = await fileTypeFromBuffer(req.file.buffer);

    if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
      return next(
        new AppError("Only JPEG, PNG, and WebP images are allowed", 400),
      );
    }

    if (req.file.mimetype !== fileType.mime) {
      return next(
        new AppError("File content does not match the file extension", 400),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validateImage;
