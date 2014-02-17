/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(SIMPLE_CONTEXT_URL);
  let [_, oscNode, gainNode, connectInfo] = yield Promise.all([
    front.setup({ reload: true }),
    once(front, "create-node"),
    once(front, "create-node"),
    once(front, "connect-node")
  ]);

  let oscType = yield oscNode.getType();
  let gainType = yield gainNode.getType();
  is(oscType, "OscillatorNode", "WebAudioActor:create-node returns AudioNodeActor");
  is(gainType, "GainNode", "WebAudioActor:create-node returns AudioNodeActor");

  let { source, dest } = connectInfo;

  is(connectInfo, 0);
  is(source, oscNode, "WebAudioActor:connect-node returns `source` node actor");
  is(dest, gainNode, "WebAudioActor:connect-node returns `dest` node actor");

  yield removeTab(target.tab);
  finish();
}
