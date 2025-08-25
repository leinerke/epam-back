const mergeUnique = (...arrays) => {
  const uniqueElements = [];
  const seen = new Set();

  for (let a = 0; a < arrays.length; a++) {
    const arr = arrays[a];
    for (let i = 0, len = arr.length; i < len; i++) {
      const element = arr[i];
      if (!seen.has(element)) {
        seen.add(element);
        uniqueElements.push(element);
      }
    }

    arr.length = 0;
  }

  return uniqueElements;
};

module.exports = { mergeUnique };
