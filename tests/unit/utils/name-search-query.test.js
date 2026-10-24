import { describe, expect, it } from "vitest";
import nameSearchQuery from "../../../utils/name-search-query.js";

describe("nameSearchQuery", () => {
  it("searches both first and last names for a single term", () => {
    expect(nameSearchQuery("john")).toEqual({
      $or: [
        { firstName: { $regex: "john", $options: "i" } },
        { lastName: { $regex: "john", $options: "i" } },
      ],
    });
  });

  it("searches first name and last name separately for two terms", () => {
    expect(nameSearchQuery("john doe")).toEqual({
      $and: [
        { firstName: { $regex: "john", $options: "i" } },
        { lastName: { $regex: "doe", $options: "i" } },
      ],
    });
  });

  it("trims whitespace", () => {
    expect(nameSearchQuery("  john   doe  ")).toEqual({
      $and: [
        { firstName: { $regex: "john", $options: "i" } },
        { lastName: { $regex: "doe", $options: "i" } },
      ],
    });
  });

  it("escapes regular-expression characters", () => {
    expect(nameSearchQuery("jo.hn+")).toEqual({
      $or: [
        { firstName: { $regex: "jo\\.hn\\+", $options: "i" } },
        { lastName: { $regex: "jo\\.hn\\+", $options: "i" } },
      ],
    });
  });
});
