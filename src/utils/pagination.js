const paginate = (page, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit };
};

module.exports = { paginate };
