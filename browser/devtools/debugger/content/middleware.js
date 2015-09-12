/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const constants = require("./constants");

function createDebuggerMiddleware (emit) {
  return ({ dispatch, getState }) => next => action => {
    let result = next(action);

    switch (action.type) {
      case constants.UPDATE_EVENT_BREAKPOINTS:
        emit("@redux:activeEventNames", getState().eventListeners.activeEventNames);
        break;
      case constants.FETCH_EVENT_LISTENERS:
        if (action.status === "done") {
          emit("@redux:listeners", getState().eventListeners.listeners);
        }
        break;
    }
    return result;
  };
}

exports.createDebuggerMiddleware = createDebuggerMiddleware;
