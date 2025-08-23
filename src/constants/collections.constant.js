'use strict';

const COLLECTIONS = {
  USERS: 'users',
  BOOKS: 'books',
  LIBRARY: 'library',
  SEARCH_HISTORY: 'search-history',
};

/**
 * @typedef {typeof COLLECTIONS[keyof typeof COLLECTIONS]} COLLECTIONS_TYPE
 */

module.exports = { COLLECTIONS };
