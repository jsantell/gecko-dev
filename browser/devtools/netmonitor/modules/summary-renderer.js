/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { ViewHelpers } = require("resource:///modules/devtools/ViewHelpers.jsm");
const { SideMenuWidget } = require("resource:///modules/devtools/SideMenuWidget.jsm");
const { PluralForm } = require("resource://gre/modules/PluralForm.jsm");
const { EventTarget } = require("sdk/event/target");
const { debounce } = require("sdk/lang/functional");
const { Class } = require("sdk/core/heritage");
const utils = require("devtools/netmonitor/utils");
const NET_STRINGS_URI = "chrome://browser/locale/devtools/netmonitor.properties";

const L10N = new ViewHelpers.L10N(NET_STRINGS_URI);
const SUMMARY_REFRESH_RATE = 100;
const CONTENT_SIZE_DECIMALS = 2;
const REQUEST_TIME_DECIMALS = 2;

/**
 * Summary Renderer for displaying total information on requests.
 */
const SummaryRenderer = exports.SummaryRenderer = Class({
  extends: EventTarget,

  /**
   * Binds RequestCollection events to the `refresh` method.
   */
  initialize: function (el, requests) {
    this.el = el;
    this.requests = requests;

    el.setAttribute("value", L10N.getStr("networkMenu.empty"));

    this.refresh = debounce(this.refresh.bind(this), SUMMARY_REFRESH_RATE);
    requests.on("add", this.refresh);
    requests.on("change", this.refresh);
    requests.on("filtered", this.refresh);
    requests.on("reset", this.refresh);
  },

  /**
   * Cleans up the renderer.
   */
  destroy: function () {
    requests.off("add", this.refresh);
    requests.off("change", this.refresh);
    requests.off("filtered", this.refresh);
    requests.off("reset", this.refresh);
  },

  /**
   * Summarizes and renders the requests.
   */
  refresh: function () {
    let filtered = this.requests.getFiltered();
    if (!filtered.length) {
      this.el.setAttribute("value", L10N.getStr("networkMenu.empty"));
      return;
    }

    let totalBytes = utils.getTotalBytesOfRequests(filtered);
    let totalMillis =
      utils.getNewestRequest(filtered).endedMillis -
      utils.getOldestRequest(filtered).startedMillis;
    let str = PluralForm.get(filtered.length, L10N.getStr("networkMenu.summary"));

    this.el.setAttribute("value", str
        .replace("#1", filtered.length)
        .replace("#2", L10N.numberWithDecimals((totalBytes || 0) / 1024, CONTENT_SIZE_DECIMALS))
        .replace("#3", L10N.numberWithDecimals((totalMillis || 0) / 1024, REQUEST_TIME_DECIMALS)));
  }
});
