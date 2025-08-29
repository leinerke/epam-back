const dbName = 'epam';
/** @type {import('mongodb').Collection} books */
const books = db.getSiblingDB(dbName).getCollection('books');
/** @type {import('mongodb').Collection} searchhistory */
const searchhistory = db.getSiblingDB(dbName).getCollection('search-history');
/** @type {import('mongodb').Collection} library */
const library = db.getSiblingDB(dbName).getCollection('library');
/** @type {import('mongodb').Collection} users */
const users = db.getSiblingDB(dbName).getCollection('users');

books.createIndex(
  { key: 1 },
  {
    name: 'key_u',
    unique: true,
    collation: {
      locale: 'en',
      strength: 2,
    },
  },
);
books.createIndex(
  { titleTokens: 1 },
  {
    name: 'titleTokens_1',
    collation: {
      locale: 'en',
      strength: 2,
    },
  },
);
books.createIndex(
  { authorTokens: 1 },
  {
    name: 'authorTokens_1',
    collation: {
      locale: 'en',
      strength: 2,
    },
  },
);
books.createIndex({ hasReviews: 1 }, { name: 'hasReviews_1' });
books.createIndex({ ratingAvg: 1 }, { name: 'ratingAvg_1' });

searchhistory.createIndex({ userId: 1 }, { name: 'userId_1' });
library.createIndex({ userId: 1 }, { name: 'userId_1' });

users.createIndex(
  { email: 1 },
  {
    name: 'email_u',
    unique: true,
    collation: {
      locale: 'en',
      strength: 2,
    },
  },
);
