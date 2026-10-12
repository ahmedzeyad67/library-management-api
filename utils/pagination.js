const paginate = async (model, query = {}, options = {}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const sort = options.sort
    ? { [options.sort]: options.order === "desc" ? -1 : 1 }
    : {};

  let dataQuery = model.find(query).sort(sort).skip(skip).limit(limit);

  if (options.populate) {
    dataQuery = dataQuery.populate(options.populate);
  }

  const [data, total] = await Promise.all([
    dataQuery,
    model.countDocuments(query),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export default paginate;
