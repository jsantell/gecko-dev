/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that the devtools/shared/worker communicates properly
// as both CommonJS module and as a JSM.

const WORKER_URL = "resource:///modules/devtools/GraphsWorker.js";

const count = 100000;
const WORKER_DATA = (function () {
  let timestamps = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(i);
  }
  return timestamps;
})();
const INTERVAL = 100;
const DURATION = 1000;

add_task(function*() {
  // Test both CJS and JSM versions
  yield testWorker(() => Cu.import("resource:///modules/devtools/shared/worker.js", {}));
  yield testWorker(() => devtools.require("devtools/shared/worker"));
});

function *testWorker (workerFactory) {
  let { DevToolsWorker } = workerFactory();
  let worker = new DevToolsWorker(WORKER_URL);
  let results = yield worker.performTask("plotTimestampsGraph", {
    timestamps: WORKER_DATA,
    interval: INTERVAL,
    duration: DURATION
  });

  ok(results.plottedData.length, "worker should have returned an object with array properties");

  worker.destroy();
}
