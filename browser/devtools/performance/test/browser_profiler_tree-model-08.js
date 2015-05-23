/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that FrameNode leaves store observed stacks, and can calculate percentage
 * of stacks observed based off of a partial stack per leaf node.
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
   * |   10%   |   0    |     -> (root)
   * |   30%   |   0    |     -> A
   * |   10%   |   0    |  -> A
   *
   * |   10%   |   10%  |  B
   * |   10%   |   0    |  -> A
   *
   * |   40%   |   40%  |  D
   * |   40%   |   0    |  -> B
   * |   40%   |   0    |     -> A
   *
   *
   * XXX In the case where C <- B directly from root, should we add the extra 10% to the root?
   * I'm guessing we shouldn't show root in the inverted case once we have correct timing like
   * this, as we can see if C <- B is called 40% of the time, and C <- B <- A is called 30%
   * of the time, then this is all still correct and one can infer the difference.
   */

  let TOTAL_SAMPLES = 10;
  let D = getFrameNodePath(root, "D");
  let C = getFrameNodePath(root, "C");
  let B = getFrameNodePath(root, "B");
  let A = getFrameNodePath(B, "A");
  // We're testing the percent per leaf node, so get a constant
  // to convert that percent per leaf node into total tree percent
  let D_SAMPLES = D.samples / TOTAL_SAMPLES;
  let C_SAMPLES = C.samples / TOTAL_SAMPLES;
  let B_SAMPLES = B.samples / TOTAL_SAMPLES;

  is(C.getCallerPercentByStack([B.index]) * C_SAMPLES, 0.4, "C <- B");
  is(C.getCallerPercentByStack([B.index, A.index]) * C_SAMPLES, 0.3, "C <- B <- A");
  is(C.getCallerPercentByStack([A.index]) * C_SAMPLES, 0.1, "C <- A");

  is(B.getCallerPercentByStack([A.index]) * B_SAMPLES, 0.1, "B <- A");

  is(D.getCallerPercentByStack([B.index]) * D_SAMPLES, 0.4, "D <- B");
  is(D.getCallerPercentByStack([B.index, A.index]) * D_SAMPLES, 0.4, "D <- B <- A");

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
