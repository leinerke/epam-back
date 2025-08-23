'use strict';

const { BaseDoc } = require('./base.schema.js');

/**
 * @typedef {BaseDoc & {
 *  email: string;
 *  password: string;
 *  refreshToken: string;
 * }} UserDoc
 */
module.exports = {};
