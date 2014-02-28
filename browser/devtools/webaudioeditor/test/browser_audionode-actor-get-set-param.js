/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test AudioNode#getParam() / AudioNode#setParam()
 */

function spawnTest () {
  let [target, debuggee, front] = yield initBackend(SIMPLE_CONTEXT_URL);
  let [_, [destNode, oscNode, gainNode]] = yield Promise.all([
    front.setup({ reload: true }),
    get3(front, "create-node")
  ]);

  let freq = yield oscNode.getParam("frequency");
  is(freq, "440", "AudioNode:getParam correctly fetches AudioParam");

  let type = yield oscNode.getParam("type");
  is(type, "sine", "AudioNode:getParam correctly fetches non-AudioParam");

  let type = yield oscNode.getParam("not-a-valid-param");
  is(type, "undefined", "AudioNode:getParam correctly returns false for invalid param");

  let resSuccess = yield oscNode.setParam("frequency", "220", "number");
  let freq = yield oscNode.getParam("frequency");
  is(freq, "220", "AudioNode:setParam correctly sets a `number` AudioParam");
  is(resSuccess, "", "AudioNode:setParam returns empty string for correctly set AudioParam");

  resSuccess = yield oscNode.setParam("type", "square", "string");
  let type = yield oscNode.getParam("type");
  is(type, "square", "AudioNode:setParam correctly sets a `string` non-AudioParam");
  is(resSuccess, "", "AudioNode:setParam returns empty string for correctly set AudioParam");

  resSuccess = yield oscNode.setParam("type", "\"triangle\"", "string");
  type = yield oscNode.getParam("type");
  is(type, "triangle", "AudioNode:setParam correctly removes quotes in `string` non-AudioParam");

  let resFail = yield oscNode.setParam("frequency", "hello", "string");
  freq = yield oscNode.getParam("frequency");
  ok(/is not a finite floating-point/.test(resFail), "AudioNode:setParam returns error when attempting an invalid assignment");
  is(freq, "220", "AudioNode:setParam does not modify value when an error occurs");

  yield removeTab(target.tab);
  finish();
}
