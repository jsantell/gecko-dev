/* -*- js-indent-level: 2; indent-tabs-mode: nil -*- */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test devtools.lazyDefine

function run_test() {
  const name = "asyncUtils";
  const path = "devtools/async-utils";
  const o = {};
  devtools.lazyDefine(o, name, path);
  const asyncUtils = devtools.require(path);
  // XXX: do_check_eq only works on primitive types, so we have this
  // do_check_true of an equality expression.
  do_check_true(o.asyncUtils === asyncUtils);

  // A non-main loader should get a new object via |lazyDefine|, just
  // as it would via a direct |require|.
  const o2 = {};
  let loader = new DevToolsLoader();
  loader.lazyDefine(o2, name, path);
  do_check_true(o2.asyncUtils !== asyncUtils);

  // A module required via a non-main loader that then uses |lazyDefine|
  // should also get the same object from that non-main loader.
  let exposeLoader = loader.require("xpcshell-test/exposeLoader");
  const o3 = exposeLoader.exerciseLazyRequire(name, path);
  do_check_true(o3.asyncUtils === o2.asyncUtils);
}
