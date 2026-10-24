import { describe, expect, it } from "vitest";
import isValidISBN from "../../../utils/isbn-validator.js";

describe("isValidISBN", () => {
  it.each([
    "0306406152",
    "0-306-40615-2",
    "0 306 40615 2",
  ])("accepts a valid ISBN-10: %s", (isbn) => {
    expect(isValidISBN(isbn)).toBe(true);
  });

  it("accepts an ISBN-10 ending with X", () => {
    expect(isValidISBN("080442957X")).toBe(true);
  });

  it("rejects an ISBN-10 with an invalid checksum", () => {
    expect(isValidISBN("0306406153")).toBe(false);
  });

  it("accepts a valid ISBN-13", () => {
    expect(isValidISBN("9780306406157")).toBe(true);
  });

  it("rejects an ISBN-13 with an invalid checksum", () => {
    expect(isValidISBN("9780306406158")).toBe(false);
  });

  it.each(["123456789", "12345678901", "978030640615", "97803064061570"])(
    "rejects an ISBN with an invalid length: %s",
    (isbn) => {
      expect(isValidISBN(isbn)).toBe(false);
    },
  );

  it("rejects ISBNs containing invalid characters", () => {
    expect(isValidISBN("030640615A")).toBe(false);
    expect(isValidISBN("97803064061A7")).toBe(false);
  });
});