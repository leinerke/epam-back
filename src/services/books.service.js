'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { repositories, Repos } = require('../db');
const { openLibrary } = require('../comunicators/open-library');
const { bookSchema, BookDoc } = require('../db/schemas/book.schema.js');
const { Errors } = require('moleculer');
const axios = require('axios');
const { normalize } = require('../utils/string');
const { mergeUnique } = require('../utils/array');
const { paginate } = require('../utils/pagination');

/** @typedef {{ user: { userId: string } | null }} Meta */

/** @type {import('moleculer').ServiceSchema} */
module.exports = {
  name: 'books',

  async started() {
    if (!process.env.MONGO_URI) {
      throw new Errors.MoleculerError('MONGO_URI is not set', 500);
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
    search: {
      rest: { method: 'GET', path: '/search' },
      params: {
        q: { type: 'string', min: 1 },
        page: { type: 'number', min: 1, convert: true },
      },
      /** @param {import('moleculer').Context<{ q: string, page?: number }, Meta>} ctx */
      async handler(ctx) {
        const [response] = await Promise.all([
          this.actions.fetchOpenLibrary(ctx.params, {
            meta: ctx.meta,
          }),
          this.saveSearchHistory(ctx.meta.user?.userId, ctx.params.q),
        ]);

        return response;
      },
    },

    fetchOpenLibrary: {
      visibility: 'private',
      cache: {
        keys: ['q', 'page'],
        ttl: 60 * 60 * 24 * 7, // 7 days
      },
      params: {
        q: { type: 'string', min: 1 },
        page: { type: 'number', min: 1, convert: true, optional: true },
      },
      /** @param {import('moleculer').Context<{ q: string, page?: number }>} ctx */
      async handler(ctx) {
        const search = await openLibrary.search(ctx.params);
        const keys = search.map((book) => book.key);
        /** @type {BookDoc[]} */

        /** @type {Repos} */
        const repos = this.repositories;

        const existingBooks = await repos.books.find(
          {
            key: { $in: keys },
          },
          {
            projection: {
              key: 1,
              title: 1,
              author: 1,
              publicationYear: 1,
              cover: 1,
            },
          },
        );

        if (ctx.meta.user) {
          const existingBooksInMyLibrary = await repos.library.findOne(
            {
              userId: new ObjectId(ctx.meta.user.userId),
              books: { $in: existingBooks.map((book) => book._id) },
            },
            {
              projection: {
                books: 1,
              },
            },
          );

          if (existingBooksInMyLibrary) {
            existingBooksInMyLibrary.books.forEach((bookId) => {
              const index = existingBooks.findIndex(
                (b) => b._id.toString() === bookId.toString(),
              );
              if (index !== -1) {
                existingBooks[index].isInMyLibrary = true;
              }
            });
          }
        }

        const savedBooks = await Promise.all(
          search
            .filter((book) => !existingBooks.some((b) => b.key === book.key))
            .map((book) => this.saveBook(book)),
        );

        console.log(savedBooks.length);

        return [...existingBooks, ...savedBooks];
      },
    },

    lastSearch: {
      rest: { method: 'GET', path: '/last-search' },
      cache: {
        keys: ['#user.userId'],
      },
      /** @param {import('moleculer').Context<{}, Meta>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const searchHistory = await repos.searchHistory.findOne(
          {
            userId: new ObjectId(ctx.meta.user.userId),
          },
          {
            projection: {
              queries: 1,
            },
          },
        );

        return searchHistory?.queries || [];
      },
    },

    addToMyLibrary: {
      rest: { method: 'POST', path: '/my-library/:id' },
      params: {
        id: { type: 'string', min: 1 },
      },
      /** @param {import('moleculer').Context<{ id: string }, Meta>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const book = await repos.books.findOne(
          {
            _id: new ObjectId(ctx.params.id),
          },
          {
            projection: {
              _id: 1,
            },
          },
        );

        if (!book) {
          throw new Errors.MoleculerError('Book not found', 404);
        }

        await repos.library.updateOne(
          { userId: new ObjectId(ctx.meta.user.userId) },
          { $addToSet: { books: new ObjectId(ctx.params.id) } },
          { upsert: true },
        );

        this.broker.cacher.clean(`books.myLibrary:${ctx.meta.user.userId}*`);
      },
    },

    myLibrary: {
      rest: { method: 'GET', path: '/my-library' },
      cache: {
        keys: [
          '#user.userId',
          'title',
          'author',
          'hasReviews',
          'rating',
          'page',
        ],
      },
      params: {
        title: { type: 'string', min: 1, optional: true },
        author: { type: 'string', min: 1, optional: true },
        hasReviews: { type: 'boolean', convert: true, optional: true },
        rating: {
          type: 'enum',
          values: ['1', '-1'],
          convert: true,
          optional: true,
        },
        page: { type: 'number', min: 1, convert: true },
      },
      /** @param {import('moleculer').Context<{}, Meta>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const library = await repos.library.findOne(
          {
            userId: new ObjectId(ctx.meta.user.userId),
          },
          {
            projection: {
              books: 1,
            },
          },
        );

        if (!library) {
          return [];
        }

        const query = {
          _id: { $in: library.books },
        };

        if (ctx.params.title) {
          query.$and = [
            ...(query.$and || []),
            {
              titleTokens: { $regex: '^' + this.tokenize(ctx.params.title) },
            },
          ];
        }

        if (ctx.params.author) {
          query.$and = [
            ...(query.$and || []),
            {
              authorTokens: { $regex: '^' + this.tokenize(ctx.params.author) },
            },
          ];
        }

        if (ctx.params.reviews) {
          query.$and = [
            ...(query.$and || []),
            { hasReviews: ctx.params.reviews },
          ];
        }

        const sort = {};
        if (ctx.params.rating) {
          sort.ratingAvg = Number(ctx.params.rating);
        }

        const books = await repos.books.find(query, {
          projection: {
            title: 1,
            author: 1,
            publicationYear: 1,
            cover: 1,
            reviews: {
              rating: 1,
            },
          },
          ...paginate(ctx.params.page),
          sort,
        });

        return books;
      },
    },

    getBook: {
      rest: { method: 'GET', path: '/my-library/:id' },
      cache: {
        keys: ['id'],
      },
      params: {
        id: { type: 'string', min: 1 },
      },
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const book = await repos.books.findOne(
          {
            _id: new ObjectId(ctx.params.id),
          },
          {
            projection: {
              key: 1,
              title: 1,
              author: 1,
              publicationYear: 1,
              cover: 1,
              reviews: 1,
            },
          },
        );

        if (!book) {
          throw new Errors.MoleculerError('Book not found', 404);
        }

        const users = await repos.users.find(
          {
            _id: {
              $in: book.reviews.map((review) => new ObjectId(review.userId)),
            },
          },
          {
            projection: {
              email: 1,
            },
          },
        );

        book.reviews.forEach((review) => {
          const user = users.find(
            (user) => user._id.toString() === review.userId,
          );
          delete review.userId;
          review.user = user.email;
        });

        return book;
      },
    },

    removeFromMyLibrary: {
      rest: { method: 'DELETE', path: '/my-library/:id' },
      params: {
        id: { type: 'string', min: 1 },
      },
      /** @param {import('moleculer').Context<{ id: string }, Meta>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const result = await repos.library.updateOne(
          { userId: new ObjectId(ctx.meta.user.userId) },
          { $pull: { books: new ObjectId(ctx.params.id) } },
        );

        this.broker.cacher.clean(`books.myLibrary:${ctx.meta.user.userId}*`);
      },
    },

    addReview: {
      rest: { method: 'PUT', path: '/my-library/:id' },
      params: {
        id: { type: 'string', min: 1 },
        rating: { type: 'number', min: 1, max: 5 },
        comment: { type: 'string', min: 1, max: 500 },
      },
      /** @param {import('moleculer').Context<{ id: string, rating: number, comment: string }, Meta>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const book = await repos.books.findOne(
          {
            _id: new ObjectId(ctx.params.id),
          },
          {
            projection: {
              key: 1,
            },
          },
        );

        if (!book) {
          throw new Errors.MoleculerError('Book not found', 404);
        }

        await repos.books.updateOne({ _id: new ObjectId(ctx.params.id) }, [
          {
            $set: {
              reviews: {
                $concatArrays: [
                  { $ifNull: ['$reviews', []] },
                  [
                    {
                      userId: new ObjectId(ctx.meta.user.userId),
                      rating: ctx.params.rating,
                      comment: ctx.params.comment,
                    },
                  ],
                ],
              },
            },
          },
          {
            $set: {
              ratingCount: { $size: '$reviews' },
              ratingSum: {
                $sum: {
                  $map: { input: '$reviews', as: 'r', in: '$$r.rating' },
                },
              },
            },
          },
          {
            $set: {
              ratingAvg: {
                $cond: [
                  { $gt: ['$ratingCount', 0] },
                  { $divide: ['$ratingSum', '$ratingCount'] },
                  null,
                ],
              },
              hasReviews: { $gt: ['$ratingCount', 0] },
              updatedAt: '$$NOW',
            },
          },
        ]);

        this.broker.cacher.del(`books.getBook:${ctx.params.id}`);
      },
    },
  },

  methods: {
    /** @param {string | undefined} userId @param {string} query */
    async saveSearchHistory(userId, query) {
      /** @type {Repos} */
      const repos = this.repositories;

      await repos.searchHistory.updateOne(
        { userId: new ObjectId(userId) },
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

      this.broker.cacher.del(`books.lastSearch:${userId}`);
    },

    /** @param {BookDoc} book */
    async saveBook(book) {
      const validated = bookSchema.validate(book, {
        stripUnknown: true,
      });

      if (validated.error) {
        throw new Errors.MoleculerError(
          validated.error.details.map((detail) => detail.message).join(', '),
          400,
        );
      }

      /** @type {Repos} */
      const repos = this.repositories;

      const { insertedId } = await repos.books.insertOne({
        ...validated.value,
        reviews: [],
        ratingCount: 0,
        ratingSum: 0,
        ratingAvg: null,
        hasReviews: false,
        titleTokens: this.tokenize(validated.value.title),
        authorTokens: this.tokenizeMany(validated.value.author || []),
      });

      this.downloadImageAsBase64(validated.value.cover).then((cover) => {
        repos.books
          .updateOne({ _id: insertedId }, { $set: { cover } })
          .then(() => {
            this.broker.cacher.clean(`books.fetchOpenLibrary:*`);
            this.broker.cacher.del(`books.getBook:${insertedId}`);
          })
          .catch((error) => {
            console.error(
              `Failed to download cover image for book ${book.key}: ${error.message}`,
              error.stack,
            );
          });
      });

      return await repos.books.findOne(
        { _id: insertedId },
        {
          projection: {
            key: 1,
            title: 1,
            author: 1,
            publicationYear: 1,
            cover: 1,
          },
        },
      );
    },

    /**
     * Download image from URL and convert to base64 using axios
     * @param {string} url - The URL of the image to download
     * @returns {Promise<string>} - Base64 encoded image
     */
    async downloadImageAsBase64(url) {
      try {
        let response;
        try {
          response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
          });
        } catch (error) {
          return undefined;
        }

        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString('base64');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const dataUrl = `data:${contentType};base64,${base64}`;

        return dataUrl;
      } catch (error) {
        throw new Error(`Failed to download image: ${error.message}`);
      }
    },

    /** @param {string} string */
    tokenize(string) {
      const norm = normalize(string);
      const parts = norm.match(/[a-z0-9]+/g) || [];
      return mergeUnique(parts);
    },

    /** @param {string[]} strings */
    tokenizeMany(strings) {
      const out = new Set();
      for (let i = 0; i < strings.length; i++) {
        const tokens = this.tokenize(strings[i]);
        for (let j = 0; j < tokens.length; j++) {
          out.add(tokens[j]);
        }
      }
      return [...out];
    },
  },
};
