/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that sparsifyLineData works properly.
let {sparsifyLineData} = devtools.require("resource:///modules/devtools/graph-utils");

let test = Task.async(function*() {
  waitForExplicitFinish();
  let dupe = createDuplicateHeavyArray();
  let result = yield sparsifyLineData(dupe);
  finish();
});

/**
 * Creates an array of delta/value duples with between 0 and 4
 * duplicates for each delta entry.
 */
function createDuplicateHeavyArray () {
  let data = [];
  for (let i = 0; i < 100; i++) {
    data.push({ delta: i, value: 100 - i });
    for (let j = 0; j < (i%5); j++) {
      data.push({ delta: i, value: 99 - j });
    }
  }
  return data;
};
