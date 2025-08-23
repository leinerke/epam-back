'use strict';

const { BaseDoc } = require('./base.schema.js');

/**
 * @typedef {BaseDoc & {
 *   userId: number,
 *   queries: string[],
 * }} SearchHistoryDoc
 */
module.exports = {};
