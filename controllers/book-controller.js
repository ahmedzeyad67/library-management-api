import asyncWrapper from "../middlewares/async-wrapper.js";
import bookService from "../services/book-service.js";

const getActiveBooks = asyncWrapper(async (req, res) => {
  const data = await bookService.getActiveBooks(req.query);

  res.json({
    status: "success",
    ...data,
  });
});

const getAllBooks = asyncWrapper(async (req, res) => {
  const data = await bookService.getAllBooks(req.query);

  res.json({
    status: "success",
    ...data,
  });
});

const getBookById = asyncWrapper(async (req, res) => {
  const book = await bookService.getBookById(req.params.bookId);

  res.json({ status: "success", data: book });
});

const createBook = asyncWrapper(async (req, res) => {
  const newBook = await bookService.createBook(req.body);

  res.status(201).json({ status: "success", data: newBook });
});

const updateBook = asyncWrapper(async (req, res) => {
  const updatedBook = await bookService.updateBook(req.params.bookId, req.body);

  res.json({ status: "success", data: updatedBook });
});

const activateBook = asyncWrapper(async (req, res) => {
  const updatedBook = await bookService.activateBook(req.params.bookId);

  res.json({ status: "success", data: updatedBook });
});

const deactivateBook = asyncWrapper(async (req, res) => {
  const updatedBook = await bookService.deactivateBook(req.params.bookId);

  res.json({ status: "success", data: updatedBook });
});

export default {
  getActiveBooks,
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  activateBook,
  deactivateBook,
};
