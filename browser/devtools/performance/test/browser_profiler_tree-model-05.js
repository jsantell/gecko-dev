/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if an inverted call tree model can be correctly computed from a samples
 * array.
 */

function test() {
  let { ThreadNode } = devtools.require("devtools/performance/tree-model");

  let root = new ThreadNode(gThread, { invertTree: true });

  is(root.calls.length, 3,
     "Should get the 3 youngest frames, not the 1 oldest frame");

  /**
   * Expected Tree
   * +--total--+--self--+--tree-------------+
   * |   50%   |   50%  |  C
   * |   25%   |   0    |  -> B
   * |   25%   |   0    |     -> A
   * |   25%   |   0    |  -> A
   *
   * |   25%   |   25%  |  B
   * |   25%   |   0    |  -> A
   *
   * |   25%   |   25%  |  D
   * |   25%   |   0    |  -> B
   * |   25%   |   0    |     -> A
   */

  let C = getFrameNodePath(root, "C");
  ok(C, "Should have C as a child of the root.");

  is(C.calls.length, 2, "Should have 2 frames that called C.");
  ok(getFrameNodePath(C, "B"), "B called C.");
  ok(getFrameNodePath(C, "A"), "A called C.");

  is(getFrameNodePath(C, "B").calls.length, 1);
  ok(getFrameNodePath(C, "B > A"), "A called B called C");
  is(getFrameNodePath(C, "A").calls.length, 0);

  let B = getFrameNodePath(root, "B");
  ok(B, "Should have B as a child of the root.");
  is(B.calls.length, 1, "Should have 1 frame that called B directly.");
  ok(getFrameNodePath(B, "A"), "A called B.");
  is(getFrameNodePath(B, "A").calls.length, 0);

  let D = getFrameNodePath(root, "D");
  ok(D, "Should have D as a child of the root.");

  is(D.calls.length, 1, "Should have 1 frame that called D.");
  ok(getFrameNodePath(D, "B"), "B called D.");

  is(getFrameNodePath(D, "B").calls.length, 1);
  ok(getFrameNodePath(D, "B > A"), "A called B called D");

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
}]);
