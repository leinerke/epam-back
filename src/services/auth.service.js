'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { repositories, Repos } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Errors } = require('moleculer');
const { userSchema } = require('../db/schemas/user.schema.js');

/** @type {import('moleculer').ServiceSchema} */
module.exports = {
  name: 'auth',

  async started() {
    if (!process.env.MONGO_URI) {
      throw new Errors.MoleculerError('MONGO_URI is not set', 500);
    }

    this.mongoClient = await MongoClient.connect(process.env.MONGO_URI);
    this.db = this.mongoClient.db();
    this.repositories = repositories(this.db);
  },

  async stopped() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  },

  actions: {
    signUp: {
      rest: { method: 'POST', path: '/sign-up' },
      params: {
        email: { type: 'email' },
        password: { type: 'string', min: 6, max: 72 },
      },
      /** @param {import('moleculer').Context<{ email: string, password: string }>} ctx */
      async handler(ctx) {
        const validated = userSchema.validate(
          {
            email: ctx.params.email,
            password: ctx.params.password,
            refreshToken: '',
          },
          { stripUnknown: true, abortEarly: false },
        );

        if (validated.error) {
          throw new Errors.MoleculerError(
            validated.error.details.map((detail) => detail.message).join(', '),
            400,
          );
        }

        /** @type {Repos} */
        const repos = this.repositories;
        const user = await repos.users.findOne({
          email: validated.value.email,
        });

        if (user) {
          throw new Errors.MoleculerError('User already exists', 400);
        }

        const hashedPassword = await bcrypt.hash(
          validated.value.password,
          await bcrypt.genSalt(),
        );

        await repos.users.insertOne({
          ...validated.value,
          password: hashedPassword,
        });
      },
    },

    signIn: {
      rest: { method: 'POST', path: '/sign-in' },
      params: {
        email: { type: 'email' },
        password: { type: 'string', min: 6 },
      },
      /** @param {import('moleculer').Context<{ email: string, password: string }>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        const user = await repos.users.findOne({ email: ctx.params.email });

        if (
          !user ||
          !(await bcrypt.compare(ctx.params.password, user.password))
        ) {
          throw new Errors.MoleculerError('Invalid credentials', 401);
        }

        const tokens = {
          accessToken: this.generateToken(user),
          refreshToken: this.generateToken(user, true),
        };

        await repos.users.updateOne(
          { _id: user._id },
          { $set: { refreshToken: tokens.refreshToken } },
        );

        return tokens;
      },
    },

    refreshToken: {
      rest: { method: 'POST', path: '/refresh-token' },
      params: {
        refreshToken: { type: 'string' },
      },
      /** @param {import('moleculer').Context<{ refreshToken: string }>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;

        /** @type {{userId: string}} */
        let payload;

        try {
          payload = jwt.verify(
            ctx.params.refreshToken,
            process.env.JWT_REFRESH_SECRET,
          );
        } catch (error) {
          throw new Errors.MoleculerError('Invalid refresh token', 401);
        }

        const user = await repos.users.findOne({
          _id: new ObjectId(payload.userId),
        });

        if (!user || user.refreshToken !== ctx.params.refreshToken) {
          throw new Errors.MoleculerError('Invalid refresh token', 401);
        }

        return {
          accessToken: this.generateToken(user),
        };
      },
    },

    signOut: {
      rest: { method: 'POST', path: '/sign-out' },
      params: {
        refreshToken: { type: 'string' },
      },
      /** @param {import('moleculer').Context<{ refreshToken: string }>} ctx */
      async handler(ctx) {
        /** @type {Repos} */
        const repos = this.repositories;
        /** @type {{userId: string}} */
        let payload;

        try {
          payload = jwt.verify(
            ctx.params.refreshToken,
            process.env.JWT_REFRESH_SECRET,
          );
        } catch (error) {
          throw new Errors.MoleculerError('Invalid refresh token', 401);
        }

        const user = await repos.users.findOne({
          _id: new ObjectId(payload.userId),
        });

        if (!user || user.refreshToken !== ctx.params.refreshToken) {
          throw new Errors.MoleculerError('Invalid refresh token', 401);
        }

        await repos.users.updateOne(
          { _id: new ObjectId(payload.userId) },
          { $set: { refreshToken: '' } },
        );

        return;
      },
    },
  },

  methods: {
    /**
     * @param {import('../db/schemas/user.schema.js').UserDoc} user
     * @param {boolean} [refreshToken]
     * @returns {string}
     */
    generateToken(user, refreshToken = false) {
      return jwt.sign(
        { userId: user._id },
        refreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET,
        {
          expiresIn: refreshToken
            ? process.env.JWT_REFRESH_EXPIRES_IN
            : process.env.JWT_EXPIRES_IN,
        },
      );
    },
  },
};
