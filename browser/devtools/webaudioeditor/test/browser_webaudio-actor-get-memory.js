/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test that the WebAudioActor.getMemory() returns a hash of memory in bytes.
 */

add_task(function*() {
  let { target, front } = yield initBackend(SIMPLE_CONTEXT_URL);

  let [_, [destNode, oscNode, gainNode], [connect1, connect2]] = yield Promise.all([
    front.setup({ reload: true }),
    get3(front, "create-node"),
    get2(front, "connect-node")
  ]);

  yield wait(5000);
  let mem = yield front.getMemory();

  is(Object.keys(mem).length, 3, "getMemory() only returns memory information for current nodes");
  is(typeof mem[destNode.actorID], "number", "getMemory() returns memory for DestinationNode");
  is(typeof mem[gainNode.actorID], "number", "getMemory() returns memory for GainNode");
  is(typeof mem[oscNode.actorID], "number", "getMemory() returns memory for OscillatorNode");

  yield removeTab(target.tab);
});
