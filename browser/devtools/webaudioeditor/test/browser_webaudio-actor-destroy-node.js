/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test `destroy-node` event on WebAudioActor.
 */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(GC_URL);
  
  let waitUntilDestroyed = getN(front, "destroy-node", 10);
  let [_, _, createdNodes] = yield Promise.all([
    front.setup({ reload: true }),
    once(front, "start-context"),
    // Should create 1 destination node and 10 disposable oscillator nodes
    getN(front, "create-node", 11)
  ]);

  info("FORCE GC\n\n\n\n\n");
  // Force GC so we can ensure it's run to clear out dead AudioNodes
  Cu.forceGC();

  let destroyedNodes = yield waitUntilDestroyed;

  info(createdNodes);
  info(destroyedNodes);

  yield removeTab(target.tab);
  finish();
}
