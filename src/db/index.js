'use strict';

const { COLLECTIONS } = require('../constants/collections.constant.js');
const { CollRepo } = require('./coll-repo.js');
const { UserDoc } = require('./schemas/user.schema.js');
const { BookDoc } = require('./schemas/book.schema.js');
const { LibraryDoc } = require('./schemas/library.schema.js');
const { SearchHistoryDoc } = require('./schemas/search-history.schema.js');

/**
 * @param {import('mongodb').Db} db
 */
function repositories(db) {
  return {
    /** @type {CollRepo<UserDoc>} */
    users: new CollRepo(db, COLLECTIONS.USERS),

    /** @type {CollRepo<BookDoc>} */
    books: new CollRepo(db, COLLECTIONS.BOOKS),

    /** @type {CollRepo<LibraryDoc>} */
    library: new CollRepo(db, COLLECTIONS.LIBRARY),

    /** @type {CollRepo<SearchHistoryDoc>} */
    searchHistory: new CollRepo(db, COLLECTIONS.SEARCH_HISTORY),
  };
}

/**
 * @typedef {ReturnType<repositories>} Repos
 */

module.exports = { repositories };
