/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const OVERVIEW_UPDATE_INTERVAL = 100;
const FRAMERATE_CALC_INTERVAL = 16; // ms
const FRAMERATE_GRAPH_HEIGHT = 60; // px

/**
 * View handler for the overview panel's time view, displaying
 * framerate over time.
 */
let OverviewView = {
  /**
   * Sets up the view with event binding.
   */
  initialize: function () {
    this._framerateEl = $("#time-framerate");
    this._graphs = {};
    this._ticksData = [];

    this._start = this._start.bind(this);
    this._stop = this._stop.bind(this);
    this._onTimelineData = this._onTimelineData.bind(this);
    this._onRecordingTick = this._onRecordingTick.bind(this);

    this._initializeFramerateGraph();

    PerformanceController.on(EVENTS.RECORDING_STARTED, this._start);
    PerformanceController.on(EVENTS.RECORDING_STOPPED, this._stop);
    PerformanceController.on(EVENTS.TIMELINE_DATA, this._onTimelineData);
  },

  /**
   * Unbinds events.
   */
  destroy: function () {
    PerformanceController.off(EVENTS.RECORDING_STARTED, this._start);
    PerformanceController.off(EVENTS.RECORDING_STOPPED, this._stop);
  },

  _onRecordingTick: Task.async(function *() {
    console.log("ONRECORDINGTICK");
    console.log(this._ticksData[0]);
//    yield this._graphs.framerate.setDataWhenReady(this._ticksData);
  }),

  _initializeFramerateGraph: function () {
    let graph = new LineGraphWidget(this._framerateEl, L10N.getStr("graphs.fps"));
    graph.minDistanceBetweenPoints = 1;
    graph.fixedHeight = FRAMERATE_GRAPH_HEIGHT;
    this._graphs.framerate = graph;
  },

  /**
   * Event handlers
   */

  _start: function () {
    this._updateId = setInterval(this._onRecordingTick, OVERVIEW_UPDATE_INTERVAL);
  },

  _stop: function () {
    clearTimeout(this._updateId);
  },

  _onTimelineData: function (eventName, ...data) {
    console.log("ONTIMELINEDATA",eventName);
    if (eventName === "ticks") {
      let [delta, timestamps] = data;
      let ticksData = FramerateFront.plotFPS(timestamps, FRAMERATE_CALC_INTERVAL);
      this._ticksData.push(ticksData);
      console.log(ticksData);
    }
  }
};
