/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Waterfall view containing the timeline markers, controlled by DetailsView.
 */
let WaterfallView = {
  _startTime: 0,
  _endTime: 0,
  _markers: [],

  /**
   * Sets up the view with event binding.
   */
  initialize: Task.async(function *() {
    this.el = $("#waterfall-view");
    this._stop = this._stop.bind(this);
    this._start = this._start.bind(this);
    this._onTimelineData = this._onTimelineData.bind(this);
    this._onMarkerSelected = this._onMarkerSelected.bind(this);
    this._onRangeChange = this._onRangeChange.bind(this);
    this._onResize = this._onResize.bind(this);

    this.graph = new Waterfall($("#waterfall-graph"), $("#details-pane"));
    this.markerDetails = new MarkerDetails($("#waterfall-details"), $("#waterfall-view > splitter"));
    this.graph.on("selected", this._onMarkerSelected);
    this.graph.on("unselected", this._onMarkerSelected);
    this.markerDetails.on("resize", this._onResize);

    PerformanceController.on(EVENTS.RECORDING_STARTED, this._start);
    PerformanceController.on(EVENTS.RECORDING_STOPPED, this._stop);
    PerformanceController.on(EVENTS.TIMELINE_DATA, this._onTimelineData);
    OverviewView.on(EVENTS.OVERVIEW_RANGE_SELECTED, this._onRangeChange);
    OverviewView.on(EVENTS.OVERVIEW_RANGE_CLEARED, this._onRangeChange);
    yield this.graph.recalculateBounds();
  }),

  /**
   * Unbinds events.
   */
  destroy: function () {
    this.graph.off("selected", this._onMarkerSelected);
    this.graph.off("unselected", this._onMarkerSelected);
    this.markerDetails.off("resize", this._onResize);
    this.markerDetails.destroy();

    PerformanceController.off(EVENTS.RECORDING_STARTED, this._start);
    PerformanceController.off(EVENTS.RECORDING_STOPPED, this._stop);
    PerformanceController.off(EVENTS.TIMELINE_DATA, this._onTimelineData);
    OverviewView.off(EVENTS.OVERVIEW_RANGE_SELECTED, this._onRangeChange);
    OverviewView.off(EVENTS.OVERVIEW_RANGE_CLEARED, this._onRangeChange);
  },

  render: Task.async(function *(markers, epoch, startTime, endTime) {
    markers = markers || this._markers;
    epoch = epoch || this._startTime;
    startTime = startTime || this._startTime;
    endTime = endTime || this._endTime;
    this.graph.resetSelection();
    yield this.graph.recalculateBounds();
    this.graph.setData(markers, epoch, startTime, endTime);
    this.emit(EVENTS.WATERFALL_RENDERED);
  }),

  /**
   * Event handlers
   */

  /**
   * Fired when a range is selected or cleared in the OverviewView.
   */
  _onRangeChange: function (_, params) {
    // When a range is cleared, we'll have no beginAt/endAt data,
    // so the rebuild will just render all the data again.
    let { beginAt, endAt } = params || {};

    // The `startAt` and `endAt` values are delta from `this._startTime`,
    let start = this._startTime + (beginAt || 0);
    let end = this._startTime + (endAt || this._endTime);
    this.render(this._markers, this._startTime, start, end);
  },

  /**
   * Called when recording starts.
   */
  _start: function (_, { startTime }) {
    this._startTime = startTime;
    this._endTime = startTime;
    this.graph.clearView();
  },

  /**
   * Called when recording stops.
   */
  _stop: Task.async(function *(_, { endTime }) {
    this._endTime = endTime;
    this._markers = this._markers.sort((a,b) => (a.start > b.start));
    this.render();
  }),

  /**
   * Called when a marker is selected in the waterfall view,
   * updating the markers detail view.
   */
  _onMarkerSelected: function (event, marker) {
    if (event === "selected") {
      this.markerDetails.render(marker);
    }
    if (event === "unselected") {
      this.markerDetails.empty();
    }
  },

  /**
   * Called when the marker details view is resized.
   */
  _onResize: function () {
    this.render();
  },

  /**
   * Called when the TimelineFront has new data for
   * framerate, markers or memory, and stores the data
   * to be plotted subsequently.
   */
  _onTimelineData: function (_, eventName, ...data) {
    if (eventName === "markers") {
      let [markers, endTime] = data;
      Array.prototype.push.apply(this._markers, markers);
    }
  }
};


/**
 * Convenient way of emitting events from the view.
 */
EventEmitter.decorate(WaterfallView);
