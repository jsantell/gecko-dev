/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests the SourceMapController updates generated sources when source maps
 * are subsequently found. Also checks when no column is provided, and
 * when tagging an already source mapped location initially.
 */

// Empty page
const PAGE_URL = `${DEBUGGER_ROOT}doc_empty-tab-01.html`;
const JS_URL = `${DEBUGGER_ROOT}code_binary_search.js`;
const COFFEE_URL = `${DEBUGGER_ROOT}code_binary_search.coffee`;
const { SourceLocationController } = require("devtools/client/shared/source-maps/source-location");

add_task(function*() {
  let { toolbox, target } = yield initTool(PAGE_URL, "jsdebugger");
  let mm = getFrameScript();

  let controller = new SourceLocationController(target);

  let aggregator = [];

  function onUpdate (oldLoc, newLoc) {
    console.log("TEST: ON UPDATE", oldLoc, newLoc);
    if (oldLoc.line === 6) {
      checkLocation(oldLoc, { line: 6, column: null, url: JS_URL }, "JS");
      checkLocation(newLoc, { line: 4, column: 2, url: COFFEE_URL }, "COFFEE");
    } else if (oldLoc.line === 8) {
      checkLocation(oldLoc, { line: 8, column: 3, url: JS_URL }, "JS");
      checkLocation(newLoc, { line: 6, column: 10, url: COFFEE_URL }, "COFFEE");
    } else if (oldLoc.line === 2) {
      checkLocation(oldLoc, { line: 2, column: 0, url: COFFEE_URL }, "COFFEE");
      checkLocation(newLoc, { line: 2, column: 0, url: COFFEE_URL }, "COFFEE->COFFEE");
    } else {
      throw new Error(`Unexpected location update: ${JSON.stringify(oldLoc)}`);
    }
    aggregator.push(newLoc);
  }

  let loc1 = { url: JS_URL, line: 6 };
  let loc2 = { url: JS_URL, line: 8, column: 3 };
  let loc3 = { url: COFFEE_URL, line: 2, column: 0 };

  controller.bindLocation(loc1, onUpdate);
  controller.bindLocation(loc2, onUpdate);
  controller.bindLocation(loc3, onUpdate);

  // Inject JS script
  yield createScript(mm, JS_URL);

  yield waitUntil(() => aggregator.length === 3);

  ok(aggregator.find(i => i.url === COFFEE_URL && i.line === 4), "found first updated location");
  ok(aggregator.find(i => i.url === COFFEE_URL && i.line === 6), "found second updated location");
  ok(aggregator.find(i => i.url === COFFEE_URL && i.line === 2), "found third updated location");

  controller.destroy();
  yield toolbox.destroy();
  gBrowser.removeCurrentTab();
  finish();
});
