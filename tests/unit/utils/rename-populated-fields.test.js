import { describe, expect, it, vi } from "vitest";
import renamePopulatedFields from "../../../utils/rename-populated-fields.js";

describe("renamePopulatedFields", () => {
  it("renames populated userId and bookId fields", () => {
    const document = {
      toObject: vi.fn().mockReturnValue({
        _id: "loan-1",
        userId: { _id: "user-1", firstName: "John" },
        bookId: { _id: "book-1", title: "Clean Code" },
        status: "borrowed",
      }),
    };

    const result = renamePopulatedFields(document);

    expect(document.toObject).toHaveBeenCalledOnce();
    expect(result).toEqual({
      _id: "loan-1",
      user: { _id: "user-1", firstName: "John" },
      book: { _id: "book-1", title: "Clean Code" },
      status: "borrowed",
    });
  });
});
