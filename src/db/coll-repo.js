'use strict';

/**
 * @template TDoc
 */
class CollRepo {
  /** @type {import('mongodb').Db} */ #db;
  /** @type {import('../constants/collections.constant').COLLECTIONS_TYPE} */ #name;

  /**
   * @param {import('mongodb').Db} db
   * @param {import('../constants/collections.constant').COLLECTIONS_TYPE} name
   */
  constructor(db, name) {
    this.#db = db;
    this.#name = name;
  }

  /**
   * @param {TDoc} doc
   * @param {import('mongodb').InsertOneOptions} [options]
   * @returns {Promise<import('mongodb').InsertOneResult<TDoc>>}
   */
  async insertOne(doc, options) {
    try {
      const now = new Date();
      return await this.#db.collection(this.#name).insertOne(
        {
          ...doc,
          createdAt: now,
          updatedAt: now,
        },
        options,
      );
    } catch (error) {
      console.error(
        `Error inserting one - ${this.#name} - ${JSON.stringify(doc)} - ${JSON.stringify(options)}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * @param {TDoc[]} docs
   * @param {import('mongodb').InsertManyOptions} [options]
   * @returns {Promise<import('mongodb').InsertManyResult<TDoc>>}
   */
  async insertMany(docs, options) {
    try {
      const now = new Date();
      return await this.#db.collection(this.#name).insertMany(
        docs.map((doc) => ({
          ...doc,
          createdAt: now,
          updatedAt: now,
        })),
        options,
      );
    } catch (error) {}
    console.error(
      `Error inserting many - ${this.#name} - ${JSON.stringify(docs)} - ${JSON.stringify(options)}`,
      error.stack,
    );
    throw error;
  }

  /**
   * @param {import('mongodb').Filter<TDoc>} filter
   * @param {import('mongodb').FindOptions} [options]
   * @returns {Promise<TDoc[]>}
   */
  async find(filter, options) {
    try {
      return await this.#db
        .collection(this.#name)
        .find(filter, options)
        .toArray();
    } catch (error) {
      console.error(
        `Error finding - ${this.#name} - ${JSON.stringify(filter)} - ${JSON.stringify(options)}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * @param {import('mongodb').Filter<TDoc>} filter
   * @param {import('mongodb').FindOneOptions} [options]
   * @returns {Promise<TDoc | null>}
   */
  async findOne(filter, options) {
    try {
      return await this.#db.collection(this.#name).findOne(filter, options);
    } catch (error) {
      console.error(
        `Error finding one - ${this.#name} - ${JSON.stringify(filter)} - ${JSON.stringify(options)}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * @param {import('mongodb').Filter<TDoc>} filter
   * @param {import('mongodb').UpdateFilter<TDoc> | import('mongodb').Document[]} update
   * @param {import('mongodb').FindOneAndUpdateOptions} [options]
   * @returns {Promise<TDoc>}
   */
  async findOneAndUpdate(filter, update, options) {
    try {
      const coll = this.#db.collection(this.#name);
      const now = new Date();

      if (Array.isArray(update)) {
        const pipeline = update.slice();
        pipeline.push({
          $set: {
            updatedAt: now,
            createdAt: { $ifNull: ['$createdAt', now] },
          },
        });
        return await coll.findOneAndUpdate(filter, pipeline, {
          ...options,
        });
      }

      return await coll.findOneAndUpdate(
        filter,
        {
          ...update,
          $set: {
            ...(update.$set || {}),
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        options,
      );
    } catch (error) {
      console.error(
        `Error finding one and updating - ${this.#name} - ${JSON.stringify(filter)} - ${JSON.stringify(update)} - ${JSON.stringify(options)}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * @param {import('mongodb').Filter<TDoc>} filter
   * @param {import('mongodb').UpdateFilter<TDoc> | import('mongodb').Document[]} update
   * @param {import('mongodb').UpdateOptions} [options]
   * @returns {Promise<import('mongodb').UpdateResult<TDoc>>}
   */
  async updateOne(filter, update, options) {
    try {
      const coll = this.#db.collection(this.#name);
      const now = new Date();

      if (Array.isArray(update)) {
        const pipeline = update.slice();
        pipeline.push({
          $set: {
            createdAt: { $ifNull: ['$createdAt', now] },
            updatedAt: now,
          },
        });
        return await coll.updateOne(filter, pipeline, options);
      }

      return await coll.updateOne(
        filter,
        {
          ...update,
          $set: {
            ...(update.$set || {}),
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        options,
      );
    } catch (error) {
      console.error(
        `Error updating one - ${this.#name} - ${JSON.stringify(filter)} - ${JSON.stringify(update)} - ${JSON.stringify(options)}`,
        error.stack,
      );
      throw error;
    }
  }
}

module.exports = { CollRepo };
