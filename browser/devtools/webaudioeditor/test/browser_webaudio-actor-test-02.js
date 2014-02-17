/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test basic reation of simple nodes
 */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(SIMPLE_NODES_URL);
  let [_, nodes] = yield Promise.all([
    front.setup({ reload: true }),
    getN(front, "create-node", 13)
  ]);

  let actualTypes = yield Promise.all(nodes.map(node => node.getType()));
  let isSourceResult = yield Promise.all(nodes.map(node => node.isSource()));
  let expectedTypes = [
    "AudioBufferSourceNode", "ScriptProcessorNode", "AnalyserNode", "GainNode",
    "DelayNode", "BiquadFilterNode", "WaveShaperNode", "PannerNode", "ConvolverNode",
    "ChannelSplitterNode", "ChannelMergerNode", "DynamicsCompressorNode", "OscillatorNode"
  ];

  expectedTypes.forEach((type, i) => {
    is(actualTypes[i], type, type + " successfully created with correct type");
    let shouldBeSource = type === "AudioBufferSourceNode" || type === "OscillatorNode";
    if (shouldBeSource)
      is(isSourceResult[i], true, type + "'s isSource() yields into `true`");
    else
      is(isSourceResult[i], false, type + "'s isSource() yields into `false`");
  });

  yield removeTab(target.tab);
  finish();
}
