/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that when using an older server (< Fx40) where the profiler actor does not
 * have the `getBufferInfo` method that nothing breaks and RecordingModels have null
 * `getBufferUsage()` values.
 */

function spawnTest () {
  let { target, front } = yield initBackend(SIMPLE_URL, { TEST_MOCK_BUFFER_CHECK_TIMER: 10 });

  // Explicitly override the profiler's trait `bufferStatus`
  front._connection._profiler.traits.bufferStatus = false;

  let model = yield front.startRecording();
  let [_, stats] = yield onceSpread(front, "buffer-status");
  is(stats, null, "buffer-status events should emit `null`");

  let count = 0;
  while (count < 5) {
    yield once(front, "buffer-status");
    count++;
  }

  is(model.getBufferUsage(), null, "model should have `null` for its buffer usage");
  yield front.stopRecording(model);
  is(model.getBufferUsage(), null, "after recording, model should still have `null` for its buffer usage");

  yield removeTab(target.tab);
  finish();
}
