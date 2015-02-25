/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Ci } = require("chrome");
const { Services } = require("resource://gre/modules/Services.jsm");
const types = require("devtools/netmonitor/types");

var NetworkHelper = {};
Object.defineProperty(NetworkHelper, "convertToUnicode", {
  get: function() {
    return require("devtools/toolkit/webconsole/network-helper").convertToUnicode;
  },
  configurable: true,
  enumerable: true
});

/**
 * Object defining the network monitor controller components.

/**
 * Helpers for getting details about an nsIURL.
 *
 * @param nsIURL | string aUrl
 * @return string
 */
exports.getUriNameWithQuery = function(aUrl) {
  if (!(aUrl instanceof Ci.nsIURL)) {
    aUrl = nsIURL(aUrl);
  }
  let name = NetworkHelper.convertToUnicode(unescape(aUrl.fileName)) || "/";
  let query = NetworkHelper.convertToUnicode(unescape(aUrl.query));
  return name + (query ? "?" + query : "");
};

exports.getUriHostPort =  function(aUrl) {
  if (!(aUrl instanceof Ci.nsIURL)) {
    aUrl = nsIURL(aUrl);
  }
  return NetworkHelper.convertToUnicode(unescape(aUrl.hostPort));
};

/**
 * Helper for getting an abbreviated string for a mime type.
 *
 * @param string aMimeType
 * @return string
 */
exports.getAbbreviatedMimeType = function(aMimeType) {
  if (!aMimeType) {
    return "";
  }
  return (aMimeType.split(";")[0].split("/")[1] || "").split("+")[0];
};

/**
 * Gets the total number of bytes representing the cumulated content size of
 * a set of requests. Returns 0 for an empty set.
 *
 * @param array aItemsArray
 * @return number
 */
exports.getTotalBytesOfRequests = function(aItemsArray) {
  if (!aItemsArray.length) {
    return 0;
  }
  return aItemsArray.reduce((prev, curr) => prev + curr.contentSize || 0, 0);
};

/**
 * Gets the oldest (first performed) request in a set. Returns null for an
 * empty set.
 *
 * @param array aItemsArray
 * @return object
 */
exports.getOldestRequest = function(aItemsArray) {
  if (!aItemsArray.length) {
    return null;
  }
  return aItemsArray.reduce((prev, curr) =>
    prev.startedMillis < curr.startedMillis ? prev : curr);
};

/**
 * Gets the newest (latest performed) request in a set. Returns null for an
 * empty set.
 *
 * @param array aItemsArray
 * @return object
 */
exports.getNewestRequest = function(aItemsArray) {
  if (!aItemsArray.length) {
    return null;
  }
  return aItemsArray.reduce((prev, curr) =>
    prev.startedMillis > curr.startedMillis ? prev : curr);
};

/**
 * Helper for getting an nsIURL instance out of a string.
 */
function nsIURL(aUrl, aStore = nsIURL.store) {
  if (aStore.has(aUrl)) {
    return aStore.get(aUrl);
  }
  let uri = Services.io.newURI(aUrl, null, null).QueryInterface(Ci.nsIURL);
  aStore.set(aUrl, uri);
  return uri;
}
nsIURL.store = new Map();
exports.nsIURL = nsIURL;

/**
 * Parse a url's query string into its components
 *
 * @param string aQueryString
 *        The query part of a url
 * @return array
 *         Array of query params {name, value}
 */
function parseQueryString(aQueryString) {
  // Make sure there's at least one param available.
  // Be careful here, params don't necessarily need to have values, so
  // no need to verify the existence of a "=".
  if (!aQueryString) {
    return;
  }
  // Turn the params string into an array containing { name: value } tuples.
  let paramsArray = aQueryString.replace(/^[?&]/, "").split("&").map(e => {
    let param = e.split("=");
    return {
      name: param[0] ? NetworkHelper.convertToUnicode(unescape(param[0])) : "",
      value: param[1] ? NetworkHelper.convertToUnicode(unescape(param[1])) : ""
    }});
  return paramsArray;
}
exports.parseQueryString = parseQueryString;

/**
 * Parse text representation of multiple HTTP headers.
 *
 * @param string aText
 *        Text of headers
 * @return array
 *         Array of headers info {name, value}
 */
function parseHeadersText(aText) {
  return parseRequestText(aText, "\\S+?", ":");
}
exports.parseHeadersText = parseHeadersText;

/**
 * Parse readable text list of a query string.
 *
 * @param string aText
 *        Text of query string represetation
 * @return array
 *         Array of query params {name, value}
 */
function parseQueryText(aText) {
  return parseRequestText(aText, ".+?", "=");
}
exports.parseQueryText = parseQueryText;

/**
 * Parse a text representation of a name[divider]value list with
 * the given name regex and divider character.
 *
 * @param string aText
 *        Text of list
 * @return array
 *         Array of headers info {name, value}
 */
function parseRequestText(aText, aName, aDivider) {
  let regex = new RegExp("(" + aName + ")\\" + aDivider + "\\s*(.+)");
  let pairs = [];
  for (let line of aText.split("\n")) {
    let matches;
    if (matches = regex.exec(line)) {
      let [, name, value] = matches;
      pairs.push({name: name, value: value});
    }
  }
  return pairs;
}
exports.parseRequestText = parseRequestText;

/**
 * Write out a list of headers into a chunk of text
 *
 * @param array aHeaders
 *        Array of headers info {name, value}
 * @return string aText
 *         List of headers in text format
 */
function writeHeaderText(aHeaders) {
  return [(name + ": " + value) for ({name, value} of aHeaders)].join("\n");
}
exports.writeHeaderText = writeHeaderText;

/**
 * Write out a list of query params into a chunk of text
 *
 * @param array aParams
 *        Array of query params {name, value}
 * @return string
 *         List of query params in text format
 */
function writeQueryText(aParams) {
  return [(name + "=" + value) for ({name, value} of aParams)].join("\n");
}
exports.writeQueryText = writeQueryText;

/**
 * Write out a list of query params into a query string
 *
 * @param array aParams
 *        Array of query  params {name, value}
 * @return string
 *         Query string that can be appended to a url.
 */
function writeQueryString(aParams) {
  return [(name + "=" + value) for ({name, value} of aParams)].join("&");
}
exports.writeQueryString = writeQueryString;

/**
 * Checks if the "Expiration Calculations" defined in section 13.2.4 of the
 * "HTTP/1.1: Caching in HTTP" spec holds true for a collection of headers.
 *
 * @param object
 *        An object containing the { responseHeaders, status } properties.
 * @return boolean
 *         True if the response is fresh and loaded from cache.
 */
function responseIsFresh({ responseHeaders, status }) {
  // Check for a "304 Not Modified" status and response headers availability.
  if (status != 304 || !responseHeaders) {
    return false;
  }

  let list = responseHeaders.headers;
  let cacheControl = list.filter(e => e.name.toLowerCase() == "cache-control")[0];
  let expires = list.filter(e => e.name.toLowerCase() == "expires")[0];

  // Check the "Cache-Control" header for a maximum age value.
  if (cacheControl) {
    let maxAgeMatch =
      cacheControl.value.match(/s-maxage\s*=\s*(\d+)/) ||
      cacheControl.value.match(/max-age\s*=\s*(\d+)/);

    if (maxAgeMatch && maxAgeMatch.pop() > 0) {
      return true;
    }
  }

  // Check the "Expires" header for a valid date.
  if (expires && Date.parse(expires.value)) {
    return true;
  }

  return false;
}
exports.responseIsFresh = responseIsFresh;

/**
 * Helper method to get a wrapped function which can be bound to as an event listener directly and is executed only when data-key is present in event.target.
 *
 * @param function callback
 *          Function to execute execute when data-key is present in event.target.
 * @return function
 *          Wrapped function with the target data-key as the first argument.
 */
function getKeyWithEvent(callback) {
  return function(event) {
    console.log(event);
    var key = event.target.getAttribute("data-key");
    if (key) {
      callback.call(null, key);
    }
  };
}
exports.getKeyWithEvent = getKeyWithEvent;

/**
 * Sanitizes the data source used for creating charts, to follow the
 * data format spec defined in Chart.jsm.
 *
 * @param array models
 *        A collection of request items used as the data source for the chart.
 * @param boolean aEmptyCache
 *        True if the cache is considered enabled, false for disabled.
 */
exports.sanitizeChartDataSource = function (models, aEmptyCache) {
  let data = [
    "html", "css", "js", "xhr", "fonts", "images", "media", "flash", "other"
  ].map(e => ({
    cached: 0,
    count: 0,
    label: e,
    size: 0,
    time: 0
  }));

  for (let model of models) {
    let type = types.typeToChartType(model);
    if (aEmptyCache || !responseIsFresh(model)) {
      data[type].time += model.totalTime || 0;
      data[type].size += model.contentSize || 0;
    } else {
      data[type].cached++;
    }
    data[type].count++;
  }

  return data.filter(e => e.count > 0);
};
