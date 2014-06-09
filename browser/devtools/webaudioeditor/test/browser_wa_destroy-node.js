/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that the destruction node event is fired and that the nodes
 * are no longer stored internally in the tool.
 */

function spawnTest() {
  let [target, debuggee, panel] = yield initWebAudioEditor(DESTROY_NODES_URL);
  let { panelWin } = panel;
  let { gFront, $, $$, EVENTS, AudioNodes } = panelWin;

  let started = once(gFront, "start-context");

  reload(target);

  let created =  getN(gFront, "create-node", 8);
  let destroyed = getN(gFront, "destroy-node", 9);

  let [actors] = yield Promise.all([created, destroyed]);

  ok(AudioNodes.length, 2, "All nodes should be GC'd except one gain and destination.");

  yield teardown(panel);
  finish();
}

