import escapeRegex from "./escape-regex.js";

const nameSearchQuery = (searchTerm) => {
  const searchParts = searchTerm.trim().split(/\s+/);

  if (searchParts.length > 1) {
    return {
      $and: [
        { firstName: { $regex: escapeRegex(searchParts[0]), $options: "i" } },
        { lastName: { $regex: escapeRegex(searchParts[1]), $options: "i" } },
      ],
    };
  }

  return {
    $or: [
      { firstName: { $regex: escapeRegex(searchTerm), $options: "i" } },
      { lastName: { $regex: escapeRegex(searchTerm), $options: "i" } },
    ],
  };
};

export default nameSearchQuery;
