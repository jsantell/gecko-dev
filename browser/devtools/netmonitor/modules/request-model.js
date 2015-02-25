/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { XPCOMUtils } = require("resource://gre/modules/XPCOMUtils.jsm");
const CLONE_PROPERTIES = [
  "requestHeaders", "requestCookies", "requestPostData", "securityState", "securityInfo",
  "responseHeaders", "httpVersion", "status", "statusText", "headersSize", "contentSize",
  "transferredSize", "mimeType", "responseContent", "totalTime", "eventTimings", "fromCache",
  "remoteAddress", "remotePort"
];

XPCOMUtils.defineLazyModuleGetter(this, "Curl", "resource:///modules/devtools/Curl.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "CurlUtils", "resource:///modules/devtools/Curl.jsm");

/**
 * Model representing a request. Adding and destroying Requests
 * should be performed through the Request collection.
 *
 * Events:
 * - `change`: Emitted when a property changes. Args: `this, prop, value`
 * - `change:ATTRIBUTE`: Emitted when ATTRIBUTE changes. Args: `this, prop, value`
 */
const RequestModel = exports.RequestModel = Class({
  extends: EventTarget,
  requestHeaders: null,
  requestCookies: null,
  requestPostData: null,
  securityState: null,
  securityInfo: null,
  responseHeaders: null,
  httpVersion: null,
  status: null,
  statusText: null,
  headersSize: null,
  contentSize: null,
  transferredSize: null,
  mimeType: null,
  responseContent: null,
  totalTime: null,
  eventTimings: null,
  isCustom: null,
  fromCache: null,
  remoteAddress: null,
  remotePort: null,
  cloned: null,

  /**
   * Creates a new Request instance.
   *
   * @options object
   * - @param object gNetwork
   * - @param string id
   * - @param string method
   * - @param string url
   * - @param boolean isXHR
   * - @param boolean fromCache
   * - @param number startedMillis
   */
  initialize: function ({ gNetwork, id, fromCache, method, url, isXHR, startedMillis, cloned }) {
    this.gNetwork = gNetwork;
    this.id = id;
    this.url = url;
    this.method = method;
    this.isXHR = isXHR;
    this.startedMillis = startedMillis;
    this.fromCache = this.fromCache;
    this.cloned = !!cloned;
  },

  /**
   * Sets a property on this Request instance. Can either pass in two arguments
   * for `prop` and `value`, or the first argument can be an object with key-value
   * pairings that get set.
   */
  set: function (prop, value) {
    // If first argument is an object, use that
    // to set properties.
    if (typeof prop === "object") {
      for (let attr in prop) {
        this.set(attr, prop[attr]);
      }
      return;
    }

    // The information in the packet is empty, it can be safely ignored.
    if (value === undefined) {
      return void 0;
    }

    switch (prop) {
      case "responseContent":
        // If there's no mime type available when the response content
        // is received, assume text/plain as a fallback.
        if (!this.mimeType) {
          this.set("mimeType", "text/plain");
        }
        break;
      case "totalTime":
        this.endedMillis = this.startedMillis + value;
        break;
      case "requestPostData":
        return this._setRequestPostData(value);
    }

    this[prop] = value;
    emit(this, "change", this, prop, value);
  },

  _setRequestPostData: function (value) {
    let store = { headers: [], headersSize: 0 };
    let model = this;

    this.requestPostData = value;
    this.requestHeadersFromUploadStream = store;
    emit(this, "change", this, "requestPostData", value);

    // Search the POST data upload stream for request headers and add
    // them to a separate store, different from the classic headers.
    return Task.spawn(function*() {
      let postData = yield model.gNetwork.getString(value.postData.text);
      let payloadHeaders = CurlUtils.getHeadersFromMultipartText(postData);

      store.headers = payloadHeaders;
      store.headersSize = payloadHeaders.reduce(
        (acc, { name, value }) => acc + name.length + value.length + 2, 0);

      // Emit events for `requestHeadersFromUploadStream` here, as it's
      // done asynchronously and not set directly.
      emit(model, "change", model, "requestHeadersFromUploadStream", store);
    });
  },

  /**
   * Returns a promise that resolves to a Curl string that
   * can be used to recreate this request.
   */
  toCurlString: Task.async(function*() {
    // Create a sanitized object for the Curl command generator.
    let data = {
      url: this.url,
      method: this.method,
      headers: [],
      httpVersion: this.httpVersion,
      postDataText: null
    };

    // Fetch header values.
    for (let { name, value } of this.requestHeaders.headers) {
      let text = yield this.gNetwork.getString(value);
      data.headers.push({ name: name, value: text });
    }

    // Fetch the request payload.
    if (this.requestPostData) {
      let postData = this.requestPostData.postData.text;
      data.postDataText = yield this.gNetwork.getString(postData);
    }

    return Curl.generateCommand(data);
  }),

  /**
   * Returns a promise that resolves to a data URI string for this request.
   */
  toDataURI: Task.async(function*() {
    let { mimeType, text, encoding } = this.responseContent.content;

    let decoded = yield this.gNetwork.getString(text);
    return `data:${mimeType};${encoding},${decoded}`;
  }),

  /**
   * Used to see if passed in string matches the request's URL.
   */
  matchesQuery: function (query) {
    return !query || this.url.contains(query);
  },

  /**
   * Clone the selected request model.
   */
  clone: function () {
    let clone = new RequestModel({
      gNetwork: this.gNetwork,
      method: this.method,
      url: this.url,
      isXHR: this.isXHR,
      fromCache: this.fromCache,
      id: this.id,
      startedMillis: this.startedMillis,
      cloned: true
    });
    CLONE_PROPERTIES.forEach(prop => clone[prop] = this[prop]);
    return clone;
  },
});
