import Book from "../models/book-model.js";
import AppError from "../utils/app-error.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary-helper.js";
import escapeRegex from "../utils/escape-regex.js";
import paginate from "../utils/pagination.js";

const getActiveBooks = async (queryParams) => {
  const { page, limit, sort, order, search, ...query } = queryParams;

  if (search) {
    query.$or = [
      { title: { $regex: escapeRegex(search), $options: "i" } },
      { author: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  return paginate(
    Book,
    { ...query, isActive: true },
    { page, limit, sort, order },
  );
};

const getAllBooks = async (queryParams) => {
  const { page, limit, sort, order, search, ...query } = queryParams;

  if (search) {
    query.$or = [
      { title: { $regex: escapeRegex(search), $options: "i" } },
      { author: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  return paginate(Book, query, { page, limit, sort, order });
};

const getBookById = async (bookId) => {
  const book = await Book.findById(bookId);

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return book;
};

const createBook = async (bookData, coverImageFile) => {
  let coverImage;

  try {
    if (coverImageFile) {
      coverImage = await uploadToCloudinary(coverImageFile.buffer);
    }

    const newBook = new Book({
      ...bookData,
      ...(coverImage && { coverImage }),
      availableCopies: bookData.totalCopies,
    });
    await newBook.save();

    const bookResponse = newBook.toObject();

    if (bookResponse.coverImage) {
      delete bookResponse.coverImage.publicId;
    }

    return bookResponse;
  } catch (error) {
    if (coverImage?.publicId) {
      try {
        await deleteFromCloudinary(coverImage.publicId);
      } catch (err) {
        console.error("Failed to clean up uploaded cover image:", err);
      }
    }
    throw error;
  }
};

const updateBook = async (bookId, bookData, coverImageFile) => {
  const book = await Book.findById(bookId).select("+coverImage.publicId");

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  const { totalCopies, availableCopies, ...otherData } = bookData;

  if (totalCopies !== undefined) {
    const borrowedCopies = book.totalCopies - book.availableCopies;

    if (totalCopies < borrowedCopies) {
      throw new AppError(
        `Total copies cannot be less than borrowed copies (${borrowedCopies})`,
        400,
      );
    }

    otherData.totalCopies = totalCopies;
    otherData.availableCopies = totalCopies - borrowedCopies;
  }

  let uploadedImage;

  if (coverImageFile) {
    uploadedImage = await uploadToCloudinary(coverImageFile.buffer);
    otherData.coverImage = uploadedImage;
  }

  let updatedBook;

  try {
    const filter = {
      _id: bookId,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
    };

    if (uploadedImage) {
      if (book.coverImage?.publicId) {
        filter["coverImage.publicId"] = book.coverImage.publicId;
      } else {
        filter["coverImage.publicId"] = { $exists: false };
      }
    }

    updatedBook = await Book.findOneAndUpdate(
      filter,
      { $set: otherData },
      { returnDocument: "after", runValidators: true },
    );

    if (!updatedBook) {
      throw new AppError("Update failed, Please try again", 409);
    }
  } catch (error) {
    if (uploadedImage?.publicId) {
      try {
        await deleteFromCloudinary(uploadedImage.publicId);
      } catch (err) {
        console.error("Failed to clean up uploaded cover image:", err);
      }
    }
    throw error;
  }

  if (uploadedImage && book.coverImage?.publicId) {
    try {
      await deleteFromCloudinary(book.coverImage.publicId);
    } catch (err) {
      console.error("Failed to delete old cover image:", err);
    }
  }

  const bookResponse = updatedBook.toObject();

  if (bookResponse.coverImage) {
    delete bookResponse.coverImage.publicId;
  }

  return bookResponse;
};

const updateBookStatus = async (bookId, isActive) => {
  const book = await Book.findByIdAndUpdate(
    bookId,
    { isActive },
    { returnDocument: "after", runValidators: true },
  );

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return book;
};

const deactivateBook = async (bookId) => {
  return updateBookStatus(bookId, false);
};

const activateBook = async (bookId) => {
  return updateBookStatus(bookId, true);
};

export default {
  getActiveBooks,
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  activateBook,
  deactivateBook,
};
