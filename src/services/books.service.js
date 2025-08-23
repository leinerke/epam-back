'use strict';

const { MongoClient } = require('mongodb');
const { repositories, Repos } = require('../db');
const { openLibrary } = require('../comunicators/open-library');

/** @type {import('moleculer').ServiceSchema} */
module.exports = {
  name: 'books',

  async started() {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set');
    }

    /** @type {MongoClient} */
    this.mongoClient = await MongoClient.connect(process.env.MONGO_URI);

    /** @type {import('mongodb').Db} */
    this.db = this.mongoClient.db();

    /** @type {Repos} */
    this.repositories = repositories(this.db);
  },

  async stopped() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  },

  actions: {
    fetchOpenLibrary: {
      visibility: 'private',
      cache: {
        keys: ['q', 'page'],
      },
      params: {
        q: { type: 'string', min: 1 },
        page: { type: 'number', min: 1, convert: true, optional: true },
      },
      /** @param {import('moleculer').Context<{ q: string, page?: number }>} ctx */
      async handler(ctx) {
        return await openLibrary.search(ctx.params);
      },
    },

    search: {
      rest: { method: 'GET', path: '/search' },
      params: {
        q: { type: 'string', min: 1 },
        page: { type: 'number', min: 1, convert: true },
      },
      /** @param {import('moleculer').Context<{ q: string, page?: number }>} ctx */
      async handler(ctx) {
        const [response] = await Promise.all([
          this.actions.fetchOpenLibrary(ctx.params),
          this.saveSearchHistory(1, ctx.params.q),
        ]);

        return response;
      },
    },

    lastSearch: {
      rest: { method: 'GET', path: '/last-search' },
      cache: true,
      /** @param {import('moleculer').Context} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const searchHistory = await repos.searchHistory.findOne({
          userId: 1,
        });

        return searchHistory?.queries || [];
      },
    },
  },

  methods: {
    async saveSearchHistory(userId, query) {
      /** @type {Repos} */
      const repos = this.repositories;

      await repos.searchHistory.updateOne(
        { userId },
        [
          // 1) Build a base array: [newQ, ...existingQueriesOrEmpty]
          {
            $set: {
              _base: {
                $concatArrays: [
                  [query],
                  { $cond: [{ $isArray: '$queries' }, '$queries', []] },
                ],
              },
            },
          },
          // 2) Make it unique (order-preserving), slice to 5, and set timestamps/ids
          {
            $set: {
              queries: {
                $slice: [
                  {
                    $reduce: {
                      input: '$_base',
                      initialValue: [],
                      in: {
                        $cond: [
                          { $in: ['$$this', '$$value'] }, // if already in accumulator, skip
                          '$$value',
                          { $concatArrays: ['$$value', ['$$this']] }, // else append
                        ],
                      },
                    },
                  },
                  5,
                ],
              },
              userId: { $ifNull: ['$userId', 1] },
            },
          },
          // 3) Cleanup temp field
          { $unset: '_base' },
        ],
        { upsert: true },
      );
    },
  },
};
