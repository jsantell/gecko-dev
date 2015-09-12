/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { createStore, combineReducers, applyMiddleware } = require("devtools/vendor/redux");
const middlewares = require('./redux-middleware');

/**
 * This creates a dispatcher with all the standard middleware in place
 * that all code requires. It can also be optionally configured in
 * various ways, such as logging and recording.
 *
 * @param {object} opts - boolean configuration flags
 *        - log: log all dispatched actions to console
 *        - middleware: array of middleware to be included in the redux store
 */
module.exports = (opts={}) => {
  const middleware = [
    middlewares.thunk,
    middlewares.waitUntilService
  ];

  if (opts.log) {
    middleware.push(middlewares.log);
  }

  if (opts.middleware) {
    opts.middleware.forEach(fn => middleware.push(fn));
  }

  return applyMiddleware(...middleware)(createStore);
}
