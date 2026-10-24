const isValidISBN = (value) => {
  const isbn = value.replace(/[-\s]/g, "");

  // ISBN-10
  if (/^\d{9}[\dX]$/.test(isbn)) {
    let sum = 0;

    for (let i = 0; i < 10; i++) {
      const digit = isbn[i] === "X" ? 10 : Number(isbn[i]);
      sum += digit * (10 - i);
    }

    return sum % 11 === 0;
  }

  // ISBN-13
  if (/^\d{13}$/.test(isbn)) {
    let sum = 0;

    for (let i = 0; i < 13; i++) {
      const digit = Number(isbn[i]);
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    return sum % 10 === 0;
  }

  return false;
};

export default isValidISBN;
