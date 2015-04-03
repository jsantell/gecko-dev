/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Ci } = require("chrome");
loader.lazyRequireGetter(this, "Services");

// The cache used in the `nsIURL` function.
const gNSURLStore = new Map();
const CHROME_SCHEMES = ["chrome://", "resource://", "jar:file://"];
const CONTENT_SCHEMES = ["http://", "https://", "file://", "app://"];

/**
 * Parses the raw location of this function call to retrieve the actual
 * function name, source url, host name, line and column.
 */
exports.parseLocation = function parseLocation (frame) {
  // Parse the `location` for the function name, source url, line, column etc.
  let lineAndColumn = frame.location.match(/((:\d+)*)\)?$/)[1];
  let [, line, column] = lineAndColumn.split(":");
  line = line || frame.line;
  column = column || frame.column;

  let firstParenIndex = frame.location.indexOf("(");
  let lineAndColumnIndex = frame.location.indexOf(lineAndColumn);
  let resource = frame.location.substring(firstParenIndex + 1, lineAndColumnIndex);

  let url = resource.split(" -> ").pop();
  let uri = nsIURL(url);
  let functionName, fileName, hostName;

  // If the URI digged out from the `location` is valid, this is a JS frame.
  if (uri) {
    functionName = frame.location.substring(0, firstParenIndex - 1);
    fileName = (uri.fileName + (uri.ref ? "#" + uri.ref : "")) || "/";
    hostName = url.indexOf("jar:") == 0 ? "" : uri.host;
  } else {
    functionName = frame.location;
    url = null;
  }

  return {
    functionName: functionName,
    fileName: fileName,
    hostName: hostName,
    url: url,
    line: line,
    column: column
  };
},

/**
* Checks if the specified function represents a chrome or content frame.
*
* @param object frame
*        The { category, location } properties of the frame.
* @return boolean
*         True if a content frame, false if a chrome frame.
*/
exports.isContent = function isContent ({ category, location }) {
  // Only C++ stack frames have associated category information.
  return !!(!category &&
    !CHROME_SCHEMES.find(e => location.contains(e)) &&
    CONTENT_SCHEMES.find(e => location.contains(e)));
}

/**
 * Helper for getting an nsIURL instance out of a string.
 */
function nsIURL(url) {
  let cached = gNSURLStore.get(url);
  if (cached) {
    return cached;
  }
  let uri = null;
  try {
    uri = Services.io.newURI(url, null, null).QueryInterface(Ci.nsIURL);
  } catch(e) {
    // The passed url string is invalid.
  }
  gNSURLStore.set(url, uri);
  return uri;
}
