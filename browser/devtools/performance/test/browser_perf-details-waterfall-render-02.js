/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that selection in the overview renders the appropriate
 * subset in the waterfall.
 */
function spawnTest () {
  let { panel } = yield initPerformance(SIMPLE_URL);
  let { EVENTS, WaterfallView, OverviewView } = panel.panelWin;

  let updated = 0;
  WaterfallView.on(EVENTS.WATERFALL_RENDERED, () => updated++);

  let rendered = once(WaterfallView, EVENTS.WATERFALL_RENDERED);

  yield startRecording(panel);
  yield busyWait(100);
  yield stopRecording(panel);
  yield rendered;

  rendered = once(WaterfallView, EVENTS.WATERFALL_RENDERED);
  OverviewView.emit(EVENTS.OVERVIEW_RANGE_SELECTED, { beginAt: 0, endAt: 10 });
  yield rendered;

  ok(true, "Waterfall rerenders when a range in the overview graph is selected.");

  rendered = once(WaterfallView, EVENTS.WATERFALL_RENDERED);
  OverviewView.emit(EVENTS.OVERVIEW_RANGE_CLEARED);
  yield rendered;

  ok(true, "Waterfall rerenders when a range in the overview graph is removed.");

  is(updated, 3, "Waterfall rerendered 3 times.");

  yield teardown(panel);
  finish();
}
