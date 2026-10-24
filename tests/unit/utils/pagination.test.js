import { describe, expect, it, vi } from "vitest";
import paginate from "../../../utils/pagination.js";

const createModel = ({ data = [], total = 0 } = {}) => {
  const query = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  };

  const model = {
    find: vi.fn().mockReturnValue(query),
    countDocuments: vi.fn().mockResolvedValue(total),
  };

  return { model, query };
};

describe("paginate", () => {
  it("uses default pagination values", async () => {
    const { model, query } = createModel({
      data: [{ title: "Clean Code" }],
      total: 11,
    });

    const result = await paginate(model, { isActive: true });

    expect(model.find).toHaveBeenCalledWith({ isActive: true });
    expect(query.sort).toHaveBeenCalledWith({});
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(model.countDocuments).toHaveBeenCalledWith({ isActive: true });
    expect(result).toEqual({
      data: [{ title: "Clean Code" }],
      pagination: {
        page: 1,
        limit: 10,
        total: 11,
        totalPages: 2,
      },
    });
  });

  it("applies page, sorting, and population options", async () => {
    const { model, query } = createModel({ total: 25 });
    const populate = [{ path: "author" }];

    const result = await paginate(
      model,
      { category: "Technology" },
      {
        page: "3",
        limit: "5",
        sort: "createdAt",
        order: "desc",
        populate,
      },
    );

    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(query.populate).toHaveBeenCalledWith(populate);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 5,
      total: 25,
      totalPages: 5,
    });
  });
});
