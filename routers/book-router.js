import { Router } from "express";
import booksController from "../controllers/book-controller.js";
import booksValidator from "../validators/book-validator.js";
import validate from "../middlewares/validate.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import uploadImage from "../middlewares/upload-image.js";
import validateImage from "../middlewares/validate-image.js";

const router = Router();

router
  .route("/")
  .get(booksValidator.getActiveBooks, validate, booksController.getActiveBooks)
  .post(
    authenticate,
    authorize("admin"),
    uploadImage,
    validateImage,
    booksValidator.createBook,
    validate,
    booksController.createBook,
  );

router.get(
  "/admin",
  authenticate,
  authorize("admin"),
  booksValidator.getAllBooks,
  validate,
  booksController.getAllBooks,
);

router
  .route("/:bookId")
  .get(booksController.getBookById)
  .patch(
    authenticate,
    authorize("admin"),
    uploadImage,
    validateImage,
    booksValidator.updateBook,
    validate,
    booksController.updateBook,
  );

router.patch(
  "/:bookId/activate",
  authenticate,
  authorize("admin"),
  booksController.activateBook,
);

router.patch(
  "/:bookId/deactivate",
  authenticate,
  authorize("admin"),
  booksController.deactivateBook,
);

export default router;
