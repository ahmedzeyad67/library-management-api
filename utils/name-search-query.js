const nameSearchQuery = (searchTerm) => {
  const searchParts = searchTerm.trim().split(/\s+/);

  if (searchParts.length > 1) {
    return {
      $and: [
        { firstName: { $regex: searchParts[0], $options: "i" } },
        { lastName: { $regex: searchParts[1], $options: "i" } },
      ],
    };
  }

  return {
    $or: [
      { firstName: { $regex: searchTerm, $options: "i" } },
      { lastName: { $regex: searchTerm, $options: "i" } },
    ],
  };
};

export default nameSearchQuery;
