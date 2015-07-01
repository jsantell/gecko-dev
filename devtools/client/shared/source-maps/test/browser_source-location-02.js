/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests the SourceMapController updates generated sources when pretty printing
 * and un pretty printing.
 */

// Empty page
const PAGE_URL = `${DEBUGGER_ROOT}doc_empty-tab-01.html`;
const JS_URL = `${URL_ROOT}code_ugly.js`;
const { SourceLocationController } = require("devtools/client/shared/source-maps/source-location");

add_task(function*() {
  let { toolbox, panel, target } = yield initTool(PAGE_URL, "jsdebugger");
  let mm = getFrameScript();

  let controller = new SourceLocationController(target);

  let aggregator = [];
  let checkedPretty = false;
  let checkedUnpretty = false;

  function onUpdate (oldLoc, newLoc, target) {
    if (oldLoc.line === 3) {
      checkLocation(oldLoc, { line: 3, column: null, url: JS_URL }, "JS");
      checkLocation(newLoc, { line: 9, column: 0, url: JS_URL }, "JS -> PRETTY");
      checkedPretty = true;
    } else if (oldLoc.line === 9) {
      checkLocation(oldLoc, { line: 9, column: 0, url: JS_URL }, "JS -> PRETTY");
      checkLocation(newLoc, { line: 3, column: null, url: JS_URL }, "JS -> UNPRETTIED");
      checkedUnpretty = true;
    } else {
      throw new Error(`Unexpected location update: ${JSON.stringify(oldLoc)}`);
    }
    aggregator.push(newLoc);
  }

  controller.bindLocation({ url: JS_URL, line: 3 }, onUpdate);

  // Inject JS script
  yield createScript(mm, JS_URL);

  yield waitForSourceShown(panel, "code_ugly.js");

  // Pretty print
  let prettified = waitForSourceShown(panel, "code_ugly.js");
  panel.panelWin.document.getElementById("pretty-print").click();
  yield prettified;
  yield waitUntil(() => aggregator.length === 1);

  // TODO check unprettified change once bug 1177446 fixed
  /*
  let unprettified = waitForSourceShown(panel, "code_ugly.js");
  panel.panelWin.document.getElementById("pretty-print").click();

  yield unprettified;
  yield waitUntil(() => checkedUnpretty);
  */

  yield waitUntil(() => checkedPretty);

  controller.destroy();
  yield toolbox.destroy();
  gBrowser.removeCurrentTab();
  finish();
});
