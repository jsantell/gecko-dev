/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that the devtools/shared/worker can handle:
// returned primitives (or promise or Error)
// callback returns (with primitive, promise, or Error)
//
// And tests `workerify` by doing so.

const { DevToolsWorker, workerify } = devtools.require("devtools/shared/worker");
function square (x) {
  return x * x;
}

function squareCallback (x, done) {
  setTimeout(() => done(x*x), 10);
}

function squarePromise (x) {
  return new Promise((resolve) => resolve(x*x));
}

function squareCallbackPromise (x, done) {
  setTimeout(() => done(new Promise(resolve => resolve(x*x))), 10);
}

function squareError (x) {
  return new Error("Nope");
}

function squareCallbackPromiseReject (x, done) {
  setTimeout(() => done(new Promise((_,reject) => reject("Nope"))), 10);
}

function squareCallbackError (x, done) {
  setTimeout(() => done(new Error("Nope")), 10);
}

function squarePromiseError (x) {
  return new Promise((resolve) => resolve(new Error("Nope")));
}

function squarePromiseReject (x) {
  return new Promise((_, reject) => reject("Nope"));
}

add_task(function*() {
  let fn = workerify(square);
  is((yield fn(5)), 25, "return primitives successful");
  fn.destroy();

  fn = workerify(squareCallback);
  var { resolve, promise } = defer();
  fn(5, function (val) {
    is(val, 25, "callback primitives successful");
    resolve();
  });
  yield promise;
  fn.destroy();

  fn = workerify(squarePromise);
  is((yield fn(5)), 25, "promise primitives successful");
  fn.destroy();

  fn = workerify(squareCallbackPromise);
  var { resolve, promise } = defer();
  is((yield fn(5, function (val) {
    is(val, 25, "callback promise successful (in calling callback too)");
    resolve();
  })), 25, "callback promise successful");
  yield promise;
  fn.destroy();

  fn = workerify(squareError);
  try {
    yield fn(5);
    ok(false, "return error should throw");
  } catch (e) {
    ok(true, "return error should throw");
  }
  fn.destroy();

  fn = workerify(squareCallbackPromiseReject);
  try {
    yield fn(5, () => {});
    ok(false, "callback with rejected promise should reject");
  } catch (e) {
    ok(true, "callback with rejected promise should reject");
  }
  fn.destroy();

  fn = workerify(squareCallbackError);
  try {
    yield fn(5, () => {});
    ok(false, "callback with error rejected");
  } catch (e) {
    ok(true, "callback with error rejected");
  }
  fn.destroy();

  fn = workerify(squarePromiseError);
  try {
    yield fn(5);
    ok(false, "returned promise with error rejects");
  } catch (e) {
    ok(true, "returned promise with error rejects");
  }
  fn.destroy();

  fn = workerify(squarePromiseReject);
  try {
    yield fn(5);
    ok(false, "returned rejected promise rejects");
  } catch (e) {
    ok(true, "returned rejected promise rejects");
  }
  fn.destroy();
});
