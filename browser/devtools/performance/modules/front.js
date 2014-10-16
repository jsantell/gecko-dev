/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cc, Ci, Cu, Cr} = require("chrome");

Cu.import("resource://gre/modules/Task.jsm");

loader.lazyRequireGetter(this, "Services");
loader.lazyRequireGetter(this, "promise");
loader.lazyRequireGetter(this, "EventEmitter",
  "devtools/toolkit/event-emitter");
loader.lazyRequireGetter(this, "TimelineFront",
  "devtools/server/actors/timeline", true);
loader.lazyRequireGetter(this, "DevToolsUtils",
  "devtools/toolkit/DevToolsUtils");

loader.lazyImporter(this, "gDevTools",
  "resource:///modules/devtools/gDevTools.jsm");

/**
 * A cache of all PerformanceConnection instances. The keys are Toolbox objects.
 */
let SharedPerformanceConnection = new WeakMap();

/**
 * Instantiates a shared PerformanceConnection for the specified toolbox.
 * Consumers must yield on `open` to make sure the connection is established.
 *
 * @param Toolbox toolbox
 *        The toolbox owning this connection.
 */
SharedPerformanceConnection.forToolbox = function(toolbox) {
  if (this.has(toolbox)) {
    return this.get(toolbox);
  }

  let instance = new PerformanceConnection(toolbox);
  this.set(toolbox, instance);
  return instance;
};

/**
 * A connection to underlying actors (profiler, memory, framerate, etc)
 * shared by all tools in a toolbox.
 *
 * Use `SharedPerformanceConnection.forToolbox` to make sure you get the same
 * instance every time, and the `PerformanceFront` to start/stop recordings.
 *
 * @param Toolbox toolbox
 *        The toolbox owning this connection.
 */
function PerformanceConnection(toolbox) {
  EventEmitter.decorate(this);

  this._toolbox = toolbox;
  this._target = this._toolbox.target;
  this._client = this._target.client;
  this._request = this._request.bind(this);

  this._pendingTimelineConsumers = 0;
  this._pendingConsoleRecordings = [];
  this._finishedConsoleRecordings = [];
  this._onEventNotification = this._onEventNotification.bind(this);

  Services.obs.notifyObservers(null, "profiler-connection-created", null);
}

PerformanceConnection.prototype = {

  // Underlying TimelineActor
  get timeline () {
     return this._timeline;
  },

  // Underlying ProfilerActor
  get profiler () {
     return this._profiler;
  },

  /**
   * Initializes a connection to the profiler and other miscellaneous actors.
   * If already open, nothing happens.
   *
   * @return object
   *         A promise that is resolved once the connection is established.
   */
  open: Task.async(function*() {
    if (this._connected) {
      return;
    }

    // Local debugging needs to make the target remote.
    yield this._target.makeRemote();

    // Sets `this._profiler`
    yield this._connectProfilerActor();

    // Sets or shims `this._timeline`
    yield this._connectTimelineActor();

    this._connected = true;

    Services.obs.notifyObservers(null, "profiler-connection-opened", null);
  }),

  /**
   * Initializes a connection to the profiler actor.
   */
  _connectProfilerActor: Task.async(function*() {
    // Chrome debugging targets have already obtained a reference
    // to the profiler actor.
    if (this._target.chrome) {
      this._profiler = this._target.form.profilerActor;
    }
    // Or when we are debugging content processes, we already have the tab
    // specific one. Use it immediately.
    else if (this._target.form && this._target.form.profilerActor) {
      this._profiler = this._target.form.profilerActor;
      yield this._registerEventNotifications();
    }
    // Check if we already have a grip to the `listTabs` response object
    // and, if we do, use it to get to the profiler actor.
    else if (this._target.root && this._target.root.profilerActor) {
      this._profiler = this._target.root.profilerActor;
      yield this._registerEventNotifications();
    }
    // Otherwise, call `listTabs`.
    else {
      this._profiler = (yield listTabs(this._client)).profilerActor;
      yield this._registerEventNotifications();
    }
  }),

  /**
   * Initializes a connection to a timeline actor.
   */
  _connectTimelineActor: function() {
    // Only initialize the framerate front if the respective actor is available.
    // Older Gecko versions don't have an existing implementation, in which case
    // all the methods we need can be easily mocked.
    //
    // If the timeline actor exists, all underlying actors (memory, framerate) exist.
    // If using the Performance tool, and timelien actor does not exist (FxOS devices < Gecko 35),
    // then just use the mocked actor and do not display timeline data.
    //
    // TODO use framework level feature detection from bug 1069673
    if (this._target.form && this._target.form.timelineActor) {
      this._timeline = new TimelineFront(this._target.client, this._target.form);
    } else {
      this._timeline = {
        start: () => {},
        stop: () => {},
        isRecording: () => false,
        on: () => {},
        off: () => {}
      };
    }
  },

  /**
   * Sends the request over the remote debugging protocol to the
   * specified actor.
   *
   * @param string actor
   *        The designated actor. Currently supported: "profiler", "framerate".
   * @param string method
   *        Method to call on the backend.
   * @param any args [optional]
   *        Additional data or arguments to send with the request.
   * @return object
   *         A promise resolved with the response once the request finishes.
   */
  _request: function(actor, method, ...args) {
    // Handle requests to the profiler actor.
    if (actor == "profiler") {
      let deferred = promise.defer();
      let data = args[0] || {};
      data.to = this._profiler;
      data.type = method;
      this._client.request(data, deferred.resolve);
      return deferred.promise;
    }

    // Handle requests to the timeline actor.
    if (actor == "timeline") {
      switch (method) {
      // Only stop recording timeline if there are no other pending consumers.
      // Otherwise, for example, the next time `console.profileEnd` is called
      // there won't be any timeline data available, since we're reusing the
      // same actor for multiple overlapping recordings.
        case "start":
          this._pendingTimelineConsumers++;
          break;
        case "stop":
          if (--this._pendingTimelineConsumers > 0) return;
          break;
      }
      checkPendingTimelineConsumers(this);
      return this._timeline[method].apply(this._timeline, args);
    }
  },

  /**
   * Starts listening to certain events emitted by the profiler actor.
   *
   * @return object
   *         A promise that is resolved once the notifications are registered.
   */
  _registerEventNotifications: Task.async(function*() {
    let events = ["console-api-profiler", "profiler-stopped"];
    yield this._request("profiler", "registerEventNotifications", { events });
    this._client.addListener("eventNotification", this._onEventNotification);
  }),

  /**
   * Invoked whenever a registered event was emitted by the profiler actor.
   *
   * @param object response
   *        The data received from the backend.
   */
  _onEventNotification: function(event, response) {
    let toolbox = gDevTools.getToolbox(this._target);
    if (toolbox == null) {
      return;
    }
    if (response.topic == "console-api-profiler") {
      let action = response.subject.action;
      let details = response.details;
      if (action == "profile") {
        this.emit("invoked-console-profile", details.profileLabel); // used in tests
        this._onConsoleProfileStart(details);
      } else if (action == "profileEnd") {
        this.emit("invoked-console-profileEnd", details.profileLabel); // used in tests
        this._onConsoleProfileEnd(details);
      }
    } else if (response.topic == "profiler-stopped") {
      this._onPerformanceUnexpectedlyStopped();
    }
  },

  /**
   * Invoked whenever the built-in profiler module is deactivated. Since this
   * should *never* happen while there's a consumer (i.e. "toolbox") available,
   * treat this notification as being unexpected.
   *
   * This may happen, for example, if the Gecko Performance add-on is installed
   * (and isn't using the profiler actor over the remote protocol). There's no
   * way to prevent it from stopping the profiler and affecting our tool.
   */
  _onPerformanceUnexpectedlyStopped: function() {
    // Pop all pending `console.profile` calls from the stack.
    this._pendingConsoleRecordings.length = 0;
    this.emit("profiler-unexpectedly-stopped");
  }
};

/**
 * A thin wrapper around a shared PerformanceConnection for the parent toolbox.
 * Handles manually starting and stopping a recording.
 *
 * @param PerformanceConnection connection
 *        The shared instance for the parent toolbox.
 */
function PerformanceFront(connection) {
  EventEmitter.decorate(this);

  this._request = connection._request;
  this.pendingConsoleRecordings = connection._pendingConsoleRecordings;
  this.finishedConsoleRecordings = connection._finishedConsoleRecordings;

  // Pipe events from `connection` to the front
  connection.on("profile", (e, args) => this.emit(e, args));
  connection.on("profileEnd", (e, args) => this.emit(e, args));
  connection.on("profiler-unexpectedly-stopped", (e, args) => this.emit(e, args));

  // Pipe events from TimelineActor to the PerformanceFront
  // TODO should these be cleaned up/unbound?
  connection.timeline.on("markers", markers => this.emit("markers", markers));
  connection.timeline.on("memory", (delta, measurement) => this.emit("memory", delta, measurement));
  connection.timeline.on("ticks", (delta, timestamps) => this.emit("ticks", delta, timestamps));
}

PerformanceFront.prototype = {
  /**
   * Manually begins a recording session.
   *
   * @return object
   *         A promise that is resolved once recording has started.
   */
  startRecording: Task.async(function*() {
    let { isActive, currentTime } = yield this._request("profiler", "isActive");

    // Start the profiler only if it wasn't already active. The built-in
    // nsIPerformance module will be kept recording, because it's the same instance
    // for all toolboxes and interacts with the whole platform, so we don't want
    // to affect other clients by stopping (or restarting) it.
    if (!isActive) {
      yield this._request("profiler", "startProfiler", this._customPerformanceOptions);
      this._profilingStartTime = 0;
      this.emit("profiler-activated");
    } else {
      this._profilingStartTime = currentTime;
      this.emit("profiler-already-active");
    }

    // The timeline actor is target-dependent, so just make sure
    // it's recording.
    yield this._request("timeline", "start", { withTicks: true, withMemory: true });
  }),

  /**
   * Manually ends the current recording session.
   *
   * @return object
   *         A promise that is resolved once recording has stopped,
   *         with the profiler and timeline data.
   */
  stopRecording: Task.async(function*() {
    // We'll need to filter out all samples that fall out of current profile's
    // range. This is necessary because the profiler is continuously running.
    let profilerData = yield this._request("profiler", "getProfile");
    filterSamples(profilerData, this._profilingStartTime);
    offsetSampleTimes(profilerData, this._profilingStartTime);

    // Fetch the recorded refresh driver ticks, during the same time window
    // as the filtered profiler data.
    let beginAt = findEarliestSampleTime(profilerData);
    let endAt = findOldestSampleTime(profilerData);

    // TODO do we keep this? As the new Timeline actor is event based, with
    // no methods of getting retroactive data
    //let ticksData = yield this._request("timeline", "getPendingTicks", beginAt, endAt);
    yield this._request("timeline", "stop");

    // Join all the acquired data and return it for outside consumers.
    return {
      recordingDuration: profilerData.currentTime - this._profilingStartTime,
      profilerData: profilerData
    };
  }),

  /**
   * Overrides the options sent to the built-in profiler module when activating,
   * such as the maximum entries count, the sampling interval etc.
   *
   * Used in tests and for older backend implementations.
   */
  _customPerformanceOptions: {
    entries: 1000000,
    interval: 1,
    features: ["js"]
  }
};

/**
 * Filters all the samples in the provided profiler data to be more recent
 * than the specified start time.
 *
 * @param object profilerData
 *        The profiler data received from the backend.
 * @param number profilingStartTime
 *        The earliest acceptable sample time (in milliseconds).
 */
function filterSamples(profilerData, profilingStartTime) {
  let firstThread = profilerData.profile.threads[0];

  firstThread.samples = firstThread.samples.filter(e => {
    return e.time >= profilingStartTime;
  });
}

/**
 * Offsets all the samples in the provided profiler data by the specified time.
 *
 * @param object profilerData
 *        The profiler data received from the backend.
 * @param number timeOffset
 *        The amount of time to offset by (in milliseconds).
 */
function offsetSampleTimes(profilerData, timeOffset) {
  let firstThreadSamples = profilerData.profile.threads[0].samples;

  for (let sample of firstThreadSamples) {
    sample.time -= timeOffset;
  }
}

/**
 * Finds the earliest sample time in the provided profiler data.
 *
 * @param object profilerData
 *        The profiler data received from the backend.
 * @return number
 *         The earliest sample time (in milliseconds).
 */
function findEarliestSampleTime(profilerData) {
  let firstThreadSamples = profilerData.profile.threads[0].samples;

  for (let sample of firstThreadSamples) {
    if ("time" in sample) {
      return sample.time;
    }
  }
}

/**
 * Finds the oldest sample time in the provided profiler data.
 *
 * @param object profilerData
 *        The profiler data received from the backend.
 * @return number
 *         The oldest sample time (in milliseconds).
 */
function findOldestSampleTime(profilerData) {
  let firstThreadSamples = profilerData.profile.threads[0].samples;

  for (let i = firstThreadSamples.length - 1; i >= 0; i--) {
    if ("time" in firstThreadSamples[i]) {
      return firstThreadSamples[i].time;
    }
  }
}

/**
 * Asserts the value sanity of `pendingTimelineConsumers`.
 */
function checkPendingTimelineConsumers(connection) {
  if (connection._pendingTimelineConsumers < 0) {
    let msg = "Somehow the number of timeline consumers is now negative.";
    DevToolsUtils.reportException("PerformanceConnection", msg);
  }
}

/**
 * A collection of small wrappers promisifying functions invoking callbacks.
 */
function listTabs(client) {
  let deferred = promise.defer();
  client.listTabs(deferred.resolve);
  return deferred.promise;
}

exports.getPerformanceConnection = toolbox => SharedPerformanceConnection.forToolbox(toolbox);
exports.PerformanceFront = PerformanceFront;
