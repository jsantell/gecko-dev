/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

loader.lazyImporter(this, "Task", "resource://gre/modules/Task.jsm");
loader.lazyRequireGetter(this, "EventTarget", "sdk/event/target", true);
loader.lazyRequireGetter(this, "emit", "sdk/event/core", true);
loader.lazyRequireGetter(this, "Class", "sdk/core/heritage", true);

/**
 * Takes a serialized SourceActor form and returns a boolean indicating if
 * this source is related to this location, like if a location is a generated
 * source, and the source map is loaded subsequently, the new source mapped SourceActor
 * will be considered related to this location. Same with pretty printing new sources.
 *
 * @param {object} location
 * @param {object} source
 */
function isSourceRelated (location, source) {
  // If a `generatedUrl` exists, the updated/new actor is source mapped;
  // check to see if the generatedUrl matches this location's url. In
  // the pretty print case, the `url` will be the same as this location.
  return source.generatedUrl || source.url === location.url;
}

/**
 * Take a TabTarget and a location, containing a `url`, `line` and `column`,
 * resolve the location to the latest location (so a source mapped location, or
 * if pretty print status has been updated)
 *
 * @param {TabTarget} target
 * @param {object} location
 * @return {Promise<object>}
 */
function resolveLocation (target, location) {
  return Task.spawn(function*() {
    let newLocation = yield target.resolveLocation({
      url: location.url,
      line: location.line,
      column: location.column || Infinity
    });

    // Source not found, or no mapping found, so don't do anything
    if (newLocation.status === "SOURCE_NOT_FOUND" || newLocation.status === "MAP_NOT_FOUND") {
      return null;
    }

    return newLocation;
  });
}

exports.isSourceRelated = isSourceRelated;
exports.resolveLocation = resolveLocation;
