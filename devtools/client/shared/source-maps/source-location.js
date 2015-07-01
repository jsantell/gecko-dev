/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

loader.lazyRequireGetter(this, "SourceUtils", "devtools/client/shared/source-maps/utils");
loader.lazyImporter(this, "Task", "resource://gre/modules/Task.jsm");
loader.lazyRequireGetter(this, "EventTarget", "sdk/event/target", true);
loader.lazyRequireGetter(this, "emit", "sdk/event/core", true);
loader.lazyRequireGetter(this, "Class", "sdk/core/heritage", true);

const SourceLocationController = exports.SourceLocationController = Class({
  extends: EventTarget,
  initialize: function (target) {
    this.target = target;
    this.locations = new Set();
    this._onSourcesUpdated = this._onSourcesUpdated.bind(this);
    this.reset = this.reset.bind(this);
    this.destroy = this.destroy.bind(this);
    target.on("source-updated", this._onSourcesUpdated);
    target.on("navigate", this.reset);
    target.on("will-navigate", this.reset);
    target.on("close", this.destroy);
  },

  destroy: function () {
    this.locations.clear();
    this.target.off("source-updated", this._onSourcesUpdated);
    this.target.off("navigate", this.reset);
    this.target.off("will-navigate", this.reset);
    this.target.off("close", this.destroy);
    this.target = this.locations = null;
  },

  reset: function () {
    this.locations.clear();
  },

  /**
   * Add this `location` to be observed and register a callback whenever
   * the underlying source is updated.
   *
   * @param {object|string} loc
   *        - {string} url
   *        - {number} line
   *        - {number} column
   */
  bindLocation: function (location, update) {
    this.locations.add({ location, update });
  },

  /**
   * Called when a new source occurs (a normal source, source maps) or
   * an updated source (pretty print) occurs.
   *
   * @param {string} eventName
   * @param {object} sourceEvent
   */
  _onSourcesUpdated: function (_, sourceEvent) {
    let { type, source } = sourceEvent;
    console.log("on sources updated", type, source);
    // If we get a new source, and it's not a source map, abort;
    // we can have no actionable updates as this is just a new normal source.
    // Also abort if there's no `url`, which means it's unsourcemappable anyway
    // (like an eval script)
    if (!source.url || type === "newSource" && !source.isSourceMapped) {
      return;
    }

    for (let locationItem of this.locations) {
      console.log("checking", locationItem, source);
      if (SourceUtils.isSourceRelated(locationItem.location, source)) {
        this._updateSource(locationItem);
      }
    }

    // Pipe the event through this controller
    emit(this, "sources-updated", sourceEvent);
  },

  /**
   * Called on a locationItem when its underlying source has changed
   * (or a source map for its location has been found)
   */
  _updateSource: Task.async(function *(locationItem) {
    let newLocation = yield SourceUtils.resolveLocation(this.target, locationItem.location);
    if (newLocation) {
      let { url: prevUrl, line: prevLine, column: prevColumn } = locationItem.location;
      let { url, line, column } = newLocation;
      locationItem.location.url = url;
      locationItem.location.line = line;
      locationItem.location.column = column;
      locationItem.update(
        { url: prevUrl, line: prevLine, column: prevColumn },
        { url, line, column }
      );
    }
  }),
});
