/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if the profiler's tree view implementation works properly and
 * creates the correct column structure and can auto-expand all nodes.
 */

function test() {
  let { ThreadNode } = devtools.require("devtools/performance/tree-model");
  let { CallView } = devtools.require("devtools/performance/tree-view");

  let threadNode = new ThreadNode(gThread, { invertTree: true });
  // Don't display the synthesized (root) and the real (root) node twice.
  threadNode.calls = threadNode.calls[0].calls;
  let treeRoot = new CallView({ frame: threadNode, inverted: true });

  let container = document.createElement("vbox");
  treeRoot.attachTo(container);

  let $$fun = i => container.querySelectorAll(".call-tree-cell[type=function]")[i];
  let $$name = i => container.querySelectorAll(".call-tree-cell[type=function] > .call-tree-name")[i];
  let $$duration = i => container.querySelectorAll(".call-tree-cell[type=duration]")[i];
  let $$selfduration = i => container.querySelectorAll(".call-tree-cell[type=self-duration]")[i];
  let $$percentage = i => container.querySelectorAll(".call-tree-cell[type=percentage]")[i];
  let $$selfpercentage = i => container.querySelectorAll(".call-tree-cell[type=self-percentage]")[i];

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

  is(container.childNodes.length, 9,
    "The container node should have all children available.");

  [50, 25, 25, 25, 25, 25, 25, 25, 25].forEach((expected, i) => {
    is($$percentage(i).getAttribute("value"), `${expected}%`,
      `${i}th item has correct percentage: ${expected}%`);
  });
  
  [50, 0, 0, 0, 25, 0, 25, 0, 0].forEach((expected, i) => {
    is($$selfpercentage(i).getAttribute("value"), `${expected}%`,
      `${i}th item has correct self-percentage: ${expected}%`);
  });

  is($$name(0).getAttribute("value"), "C",
    "C node displays correct name");
  is($$name(1).getAttribute("value"), "B",
    "C <- B node displays correct name");
  is($$name(2).getAttribute("value"), "A",
    "C <- B <- A node displays correct name");
  is($$name(3).getAttribute("value"), "A",
    "C <- A node displays correct name");
  is($$name(4).getAttribute("value"), "B",
    "B node displays correct name");
  is($$name(5).getAttribute("value"), "A",
    "B <- A node displays correct name");
  is($$name(6).getAttribute("value"), "D",
    "D node displays correct name");
  is($$name(7).getAttribute("value"), "B",
    "D <- B node displays correct name");
  is($$name(8).getAttribute("value"), "A",
    "D <- B <- A node displays correct name");

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
