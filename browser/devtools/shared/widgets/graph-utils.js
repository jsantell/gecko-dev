/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Promise } = require("resource://gre/modules/Promise.jsm");
const { ChromeWorker } = require("chrome");
const graphUtilsWorker = new ChromeWorker("resource:///modules/devtools/graph-utils-worker.js");
let graphTaskId = 0;

exports.sparsifyLineData = function (data) {
  let id = graphTaskId++;
  let { promise, resolve } = Promise.defer();

  console.log('sparsify');
  graphUtilsWorker.addEventListener("message", function listener (data) {
    console.log("RESOLVING?", data.id, id);
    if (data.id === id) {
      graphUtilsWorker.removeEventListener("message", listener);
      resolve(data.data);
    }
  });

  console.log('posting message');
  graphUtilsWorker.postMessage({
    id: id,
    data: data
  });

  return promise;
};
