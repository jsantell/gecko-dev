/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Functions handling the audio visualization UI.
 */

let VisualizationView = {
  // Set up config for view toggling
  _collapseString: COLLAPSE_INSPECTOR_STRING,
  _expandString: EXPAND_INSPECTOR_STRING,
  _toggleEvent: EVENTS.UI_INSPECTOR_TOGGLED,
  // Do not animate, ViewHelper toggle only supports L<->R toggling anyway
  _animated: false,
  _delayed: true,

  /**
   * Initialization function called when the tool starts up.
   */
  initialize: function () {
    // Set up view controller
    this.el = $("#visualization-graph");
    this.canvas = $("#visualization-graph-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.button = $("#visualization-graph-toggle");
    mixin(this, ToggleMixin);
    this.bindToggle();

    // Hide inspector view on startup
    this.hideImmediately();

    this._onData = this._onData.bind(this);

    window.on(EVENTS.STREAM_DATA, this._onData);
  },

  /**
   * Destruction function called when the tool cleans up.
   */
  destroy: function () {
    this.unbindToggle();
    window.off(EVENTS.STREAM_DATA, this._onData);

    this.el = null;
    this.button = null;
    this._tabsPane = null;
  },

  /*
   * Event handlers
   */

  _onData: function (_, {data}) {
    drawFFT(this.ctx, data);
  }
};

// https://developer.mozilla.org/en-US/docs/Tools/DevToolsColors
var DARK_COLORS = [
  "#46afe3", "#6b7abb", "#df80ff", "#eb5368", "#d99b28"
];

function drawFFT (ctx, data) {
  let w = ctx.canvas.width;
  let h = ctx.canvas.height;
  let binWidth = w / data.length;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ff0077";
  for (var i = 0, l = data.length; i < l; i++) {
    ctx.fillStyle = DARK_COLORS[~~(data[i]/51)];
    ctx.fillRect(
      i * binWidth,
      h,
      binWidth,
      -(h / 255) * data[i]
    );
  }
}
