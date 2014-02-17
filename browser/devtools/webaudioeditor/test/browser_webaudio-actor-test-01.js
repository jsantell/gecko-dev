/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(SIMPLE_CONTEXT_URL);
  let [_, [oscNode, gainNode], [connect1, connect2]] = yield Promise.all([
    front.setup({ reload: true }),
    get2(front, "create-node"),
    get2(front, "connect-node")
  ]);

  let oscType = yield oscNode.getType();
  let gainType = yield gainNode.getType();
  is(oscType, "OscillatorNode", "WebAudioActor:create-node returns AudioNodeActor");
  is(gainType, "GainNode", "WebAudioActor:create-node returns AudioNodeActor");

  let { source, dest } = connect1;
  let sourceType = yield source.getType();
  let destType = yield dest.getType();
  is(sourceType, "OscillatorNode", "WebAudioActor:connect-node returns `source` node actor");
  is(destType, "GainNode", "WebAudioActor:connect-node returns `dest` node actor");

  let { source, dest } = connect2;
  let sourceType = yield source.getType();
  let destType = yield dest.getType();
  is(sourceType, "GainNode", "WebAudioActor:connect-node returns `source` node actor");
  is(destType, "AudioDestinationNode", "WebAudioActor:connect-node returns `dest` node actor for AudioDestinationNode");

  yield removeTab(target.tab);
  finish();
}
