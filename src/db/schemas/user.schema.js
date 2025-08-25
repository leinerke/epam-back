'use strict';

const { BaseDoc } = require('./base.schema.js');
const Joi = require('joi');

/**
 * @typedef {BaseDoc & {
 *  email: string;
 *  password: string;
 *  refreshToken: string;
 * }} UserDoc
 */

const userSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(6).max(72).required(),
  refreshToken: Joi.string().min(0).required(),
});

module.exports = { userSchema };
