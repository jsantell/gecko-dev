/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Ensures that only youngest frames capture optimization data
 */

function run_test() {
  run_next_test();
}

add_task(function test() {
  let { ThreadNode } = devtools.require("devtools/performance/tree-model");
  let root = getFrameNodePath(new ThreadNode(gThread, { startTime: 0, endTime: 25 }), "(root)");

  let A = getFrameNodePath(root, "A");
  let B = getFrameNodePath(A, "B");
  let C = getFrameNodePath(B, "C");
  let Aopts = A.getOptimizations();
  let Bopts = B.getOptimizations();
  let Copts = C.getOptimizations();

  ok(!Aopts, "A() was never youngest frame, so should not have optimization data");
  equal(Bopts.length, 2, "B() only has optimization data when it was a youngest frame");
  equal(Copts.length, 1, "C() always youngest frame, so has optimization data");
});

let gUniqueStacks = new RecordingUtils.UniqueStacks();

function uniqStr(s) {
  return gUniqueStacks.getOrAddStringIndex(s);
}

let gThread = RecordingUtils.deflateThread({
  samples: [{
    time: 0,
    frames: [
      { location: "(root)" }
    ]
  }, {
    time: 10,
    frames: [
      { location: "(root)" },
      { location: "A" },
      { location: "B_LEAF_1" }
    ]
  }, {
    time: 15,
    frames: [
      { location: "(root)" },
      { location: "A" },
      { location: "B_NOTLEAF" },
      { location: "C" },
    ]
  }, {
    time: 20,
    frames: [
      { location: "(root)" },
      { location: "A" },
      { location: "B_LEAF_2" }
    ]
  }],
  markers: []
}, gUniqueStacks);

let gRawSite1 = {
  line: 12,
  column: 2,
  types: [{
    mirType: uniqStr("Object"),
    site: uniqStr("B (http://foo/bar:10)"),
    typeset: [{
        keyedBy: uniqStr("constructor"),
        name: uniqStr("Foo"),
        location: uniqStr("B (http://foo/bar:10)")
    }, {
        keyedBy: uniqStr("primitive"),
        location: uniqStr("self-hosted")
    }]
  }],
  attempts: {
    schema: {
      outcome: 0,
      strategy: 1
    },
    data: [
      [uniqStr("Failure1"), uniqStr("SomeGetter1")],
      [uniqStr("Failure2"), uniqStr("SomeGetter2")],
      [uniqStr("Inlined"), uniqStr("SomeGetter3")]
    ]
  }
};

let gRawSite2 = {
  line: 22,
  types: [{
    mirType: uniqStr("Int32"),
    site: uniqStr("Receiver")
  }],
  attempts: {
    schema: {
      outcome: 0,
      strategy: 1
    },
    data: [
      [uniqStr("Failure1"), uniqStr("SomeGetter1")],
      [uniqStr("Failure2"), uniqStr("SomeGetter2")],
      [uniqStr("Failure3"), uniqStr("SomeGetter3")]
    ]
  }
};

function serialize (x) {
  return JSON.parse(JSON.stringify(x));
}

gThread.frameTable.data.forEach((frame) => {
  const LOCATION_SLOT = gThread.frameTable.schema.location;
  const OPTIMIZATIONS_SLOT = gThread.frameTable.schema.optimizations;

  let l = gThread.stringTable[frame[LOCATION_SLOT]];
  switch (l) {
  case "A":
    frame[OPTIMIZATIONS_SLOT] = serialize(gRawSite1);
    break;
  // Rename some of the location sites so we can register different
  // frames with different opt sites
  case "B_LEAF_1":
    frame[OPTIMIZATIONS_SLOT] = serialize(gRawSite2);
    frame[LOCATION_SLOT] = uniqStr("B");
    break;
  case "B_LEAF_2":
    frame[OPTIMIZATIONS_SLOT] = serialize(gRawSite1);
    frame[LOCATION_SLOT] = uniqStr("B");
    break;
  case "B_NOTLEAF":
    frame[OPTIMIZATIONS_SLOT] = serialize(gRawSite1);
    frame[LOCATION_SLOT] = uniqStr("B");
    break;
  case "C":
    frame[OPTIMIZATIONS_SLOT] = serialize(gRawSite1);
    break;
  }
});
