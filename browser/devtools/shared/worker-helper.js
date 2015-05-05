/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * This file is to only be included by ChromeWorkers. This exposes
 * a `createTask` function to workers to register tasks for communication
 * back to `devtools/shared/worker`.
 *
 * Tasks can be send their responses in several ways.
 *
 * 1) Return primitive value
 * If the task is synchronously executed, it can just use the return value.
 * Note that we do not use the optional second argument callback function,
 * this is necessary to note that this is a synchronous function.
 *
 * createTask(self, "average", function (data) {
 *   return data.reduce((sum, val) => sum + val, 0) / data.length;
 * });
 *
 * 2) Return promise value
 * If using promises in the worker, you can return a promise from the function.
 * Again, you must not specify a second argument callback in the function.
 * The promise's resolution will indicate whether or not the DevToolsWorker
 * response will resolve or reject as well.
 *
 * createTask(self, "average", function (data) {
 *   return new Promise((resolve, reject) => {
 *     resolve(data.reduce((sum, val) => sum + val, 0) / data.length);
 *   });
 * });
 *
 * 3) Callback
 * If using callbacks, you can specify a second argument to your worker task
 * that should be called with a result value. Callbacks can also take
 * promises and they are handled the same way as in (2).
 *
 * createTask(self, "average", function (data, callback) {
 *   sumArray(data, function (sum) {
 *     callback(sum / data.length);
 *   });
 * });
 *
 *
 * Errors:
 *
 * If responding with a promise, or calling the callback with a promise, any rejected
 * promise will propagate to the DevToolsWorker. Same with passing an Error object
 * to the callback, or returning an error object synchronously, and same
 * with resolving a promise with an Error object.
 */

/**
 * Takes a worker's `self` object, a task name, and a function to
 * be called when that task is called. The task is called with the
 * passed in data as the first argument, and a node-style callback as the second
 * argument. Pass in an error as the first argument, or the response as the second
 * argument in the callback.
 *
 * @param {object} self
 * @param {string} name
 * @param {function} fn
 */
function createTask (self, name, fn) {
  // Store a hash of task name to function on the Worker
  if (!self._tasks) {
    self._tasks = {};
  }

  // Create the onmessage handler if not yet created.
  if (!self.onmessage) {
    self.onmessage = createHandler(self);
  }

  // Store the task on the worker.
  self._tasks[name] = fn;
}

exports.createTask = createTask;

/**
 * Creates the `self.onmessage` handler for a Worker.
 *
 * @param {object} self
 * @return {function}
 */
function createHandler (self) {
  return function (e) {
    let { id, task, data } = e.data;
    let taskFn = self._tasks[task];

    if (!taskFn) {
      self.postMessage({ id, error: `Task "${task}" not found in worker.` });
      return;
    }

    try {
      let results;
      // Handle case when function is synchronous by only having
      // one or no argument in the function. Process the return value,
      // whether a primitive or promise.
      if (taskFn.length < 2) {
        handleResponse(taskFn(data));
      }
      // If the function argument signature has more than one
      // argument, the task is called with a callback function
      // as the second argument to be passed in the results.
      else {
        taskFn(data, handleResponse);
      }
    } catch (e) {
      handleError(e);
    }

    function handleResponse (response) {
      // If a promise
      if (response && typeof response.then === "function") {
        response.then(handleResponse, handleError);
      }
      // If an error object
      else if (response instanceof Error) {
        handleError(response);
      }
      // If anything else
      else {
        self.postMessage({ id, response });
      }
    }

    function handleError (e="Error") {
      self.postMessage({ id, error: e.message || e });
    }
  }
}
