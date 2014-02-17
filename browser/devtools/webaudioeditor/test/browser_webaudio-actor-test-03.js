/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test basic communication of Web Audio actor
 */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(SIMPLE_CONTEXT_URL);
  let [_, [oscNode, gainNode]] = yield Promise.all([
    front.setup({ reload: true }),
    get2(front, "create-node")
  ]);

  let freq = yield oscNode.getParam("frequency");
  is(freq, "440", "Correctly fetch parameter");

  yield oscNode.setParam("frequency", "220", "number");
  let freq = yield oscNode.getParam("frequency");
  is(freq, "220", "Correctly fetch parameter");

  yield removeTab(target.tab);
  finish();
}
