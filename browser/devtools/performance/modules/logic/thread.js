/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

loader.lazyRequireGetter(this, "FrameUtils",
  "devtools/performance/frame-utils");

let threadCache = new WeakMap();

function inflateThread (thread) {
  let cached = threadCache.get(thread);
  if (cached) {
    return cached;
  }

  let inflatedThread = new InflatedThread(thread);
  threadCache.set(thread, inflatedThread);
  return inflatedThread;
}

function InflatedThread (thread) {
  let { samples, stackTable, frameTable, stringTable, allocationsTable } = thread;
  let data = this.data = Object.create(null);
  data.samples = [];

  const SAMPLE_STACK_SLOT = samples.schema.stack;
  const SAMPLE_TIME_SLOT = samples.schema.time;

  const STACK_PREFIX_SLOT = stackTable.schema.prefix;
  const STACK_FRAME_SLOT = stackTable.schema.frame;

  const InflatedFrame = FrameUtils.InflatedFrame;
  const getOrAddInflatedFrame = FrameUtils.getOrAddInflatedFrame;

  let samplesData = samples.data;
  let stacksData = stackTable.data;

  // Caches
  let inflatedFrameCache = FrameUtils.getInflatedFrameCache(frameTable);

  // In the profiler data, each frame's stack is referenced by an index
  // into stackTable.
  //
  // Each entry in stackTable is a pair [ prefixIndex, frameIndex ]. The
  // prefixIndex is itself an index into stackTable, referencing the
  // prefix of the current stack (that is, the younger frames). In other
  // words, the stackTable is encoded as a trie of the inverted
  // callstack. The frameIndex is an index into frameTable, describing the
  // frame at the current depth.
  //
  // This algorithm inflates each frame in the frame table while walking
  // the stack trie as described above.
  for (let i = 1; i < samplesData.length; i++) {
    let sample = samplesData[i];
    let time = sample[SAMPLE_TIME_SLOT];
    let stackIndex = sample[SAMPLE_STACK_SLOT];
    let prevFrameKey;
    let inflatedSample = data.samples[i] = { time, frames: [] };

    while (stackIndex !== null) {
      let stackEntry = stacksData[stackIndex];
      let frameIndex = stackEntry[STACK_FRAME_SLOT];

      // Fetch the stack prefix (i.e. older frames) index
      stackIndex = stackEntry[STACK_PREFIX_SLOT];

      let inflatedFrame = getOrAddInflatedFrame(inflatedFrameCache, frameIndex, frameTable, stringTable, allocationsTable);

      inflatedSample.frames.push(inflatedFrame);
    }
  }
}

InflatedThread.prototype.getData = function (options={}) {
  let data = Object.create(null);
  for (let prop of this.data) {
    data[prop] = this.data[prop];
  }
  if ("startTime" in options && "endTime" in options) {
    let { startTime, endTime } = options;
    data.samples = [];
    let sample;
    for (let i = 0; i < this.data.samples.length; i++) {
      sample = this.data.samples[i];
      if (!sample.time ||
          sample.time <= startTime ||
          sample.time > endTime) {
        continue;
      }
      data.samples.push(sample);
    }
  }
  return data;
};

exports.InflatedThread = InflatedThread;
exports.inflateThread = inflateThread;
