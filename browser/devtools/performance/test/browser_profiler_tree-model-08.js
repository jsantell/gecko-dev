/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that FrameNode leaves store observed stacks, and can calculate percentage
 * of stacks observed based off of a partial stack.
 */

function test() {
  let { ThreadNode } = devtools.require("devtools/performance/tree-model");

  let root = new ThreadNode(gThread, { invertTree: true });

  /**
   * Samples
   *
   * A->C
   * A->B
   * A->B->C x4
   * A->B->D x4
   *
   * Expected Tree
   * +--total--+--self--+--tree-------------+
   * |   50%   |   50%  |  C
   * |   40%   |   0    |  -> B
   * |   40%   |   0    |     -> A
   * |   10%   |   0    |  -> A
   *
   * |   10%   |   10%  |  B
   * |   10%   |   0    |  -> A
   *
   * |   40%   |   40%  |  D
   * |   40%   |   0    |  -> B
   * |   40%   |   0    |     -> A
   */

  let D = getFrameNodePath(root, "D");
  let C = getFrameNodePath(root, "C");
  let B = getFrameNodePath(root, "B");
  let A = getFrameNodePath(B, "A");

  is(C.getCallerPercentByStack([B.index]), 0.4, "C <- B");
  is(C.getCallerPercentByStack([B.index, A.index]), 0.4, "C <- B <- A");
  is(C.getCallerPercentByStack([A.index]), 0.1, "C <- A");

  is(B.getCallerPercentByStack([A.index]), 0.1, "B <- A");

  is(D.getCallerPercentByStack([B.index]), 0.4, "D <- B");
  is(D.getCallerPercentByStack([B.index, A.index]), 0.4, "D <- B <- A");

  finish();
}

let gThread = synthesizeProfileForTest([{
  time: 5,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "C" }
  ]
}, {
  time: 10,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "D" }
  ]
}, {
  time: 15,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "C" },
  ]
}, {
  time: 20,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
  ]
}, {
  time: 25,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "C" }
  ]
}, {
  time: 30,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "C" }
  ]
}, {
  time: 35,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "D" }
  ]
}, {
  time: 40,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "D" }
  ]
}, {
  time: 45,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "C" }
  ]
}, {
  time: 50,
  frames: [
    { location: "(root)" },
    { location: "A" },
    { location: "B" },
    { location: "D" }
  ]
}]);
