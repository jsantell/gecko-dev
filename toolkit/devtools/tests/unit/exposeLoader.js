/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

exports.exerciseLazyRequire = (name, path) => {
  const o = {};
  loader.lazyDefine(o, name, path);
  return o;
};
