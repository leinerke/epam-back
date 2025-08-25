'use strict';

const { BaseDoc } = require('./base.schema.js');
const Joi = require('joi');

/**
 * @typedef {BaseDoc & {
 *   userId: number,
 *   queries: string[],
 * }} SearchHistoryDoc
 */

const searchHistorySchema = Joi.object({
  userId: Joi.string().required(),
  queries: Joi.array().items(Joi.string()).required(),
});

module.exports = { searchHistorySchema };
