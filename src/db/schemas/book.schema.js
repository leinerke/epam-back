'use strict';

const { BaseDoc } = require('./base.schema.js');
const Joi = require('joi');

/**
 * @typedef {BaseDoc & {
 *   key: string;
 *   title: string;
 *   author?: string[];
 *   publicationYear?: number;
 *   reviews: {
 *     userId: string;
 *     rating: number;
 *     comment: string;
 *   }[];
 *   ratingCount: number;
 *   ratingSum: number;
 *   ratingAvg: number|null;
 *   hasReviews: boolean;
 *   titleTokens: string[];
 *   authorTokens: string[];
 *   cover: string|null;
 * }} BookDoc
 */

const bookSchema = Joi.object({
  key: Joi.string().required(),
  title: Joi.string().required(),
  author: Joi.array().items(Joi.string()).optional(),
  publicationYear: Joi.number().optional(),
  coverUrl: Joi.string().uri().optional(),
  cover: Joi.string().optional(),
});

module.exports = { bookSchema };
