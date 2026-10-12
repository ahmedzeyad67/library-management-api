const renamePopulatedFields = (doc) => {
  const obj = doc.toObject();
  obj.user = obj.userId;
  obj.book = obj.bookId;
  delete obj.userId;
  delete obj.bookId;
  return obj;
};

export default renamePopulatedFields;
