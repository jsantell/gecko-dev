/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Editor = require("devtools/sourceeditor/editor");

const CONTENT_MIME_TYPE_ABBREVIATIONS = {
  "ecmascript": "js",
  "javascript": "js",
  "x-javascript": "js"
};

const CONTENT_MIME_TYPE_MAPPINGS = {
  "/ecmascript": Editor.modes.js,
  "/javascript": Editor.modes.js,
  "/x-javascript": Editor.modes.js,
  "/html": Editor.modes.html,
  "/xhtml": Editor.modes.html,
  "/xml": Editor.modes.html,
  "/atom": Editor.modes.html,
  "/soap": Editor.modes.html,
  "/rdf": Editor.modes.css,
  "/rss": Editor.modes.css,
  "/css": Editor.modes.css
};

/**
 * Predicates used when filtering items.
 *
 * @param object aItem
 *        The filtered item.
 * @return boolean
 *         True if the item should be visible, false otherwise.
 */
let isHtml   = exports.isHtml = ({ mimeType }) =>
               mimeType && mimeType.contains("/html");
let isCss    = exports.isCss = ({ mimeType }) =>
               mimeType && mimeType.contains("/css");
let isJs     = exports.isJs = ({ mimeType }) =>
               mimeType && (
                 mimeType.contains("/ecmascript") ||
                 mimeType.contains("/javascript") ||
                 mimeType.contains("/x-javascript"));
let isXHR    = exports.isXHR = ({ isXHR }) => isXHR;
let isFont   = exports.isFont = ({ url, mimeType }) => // Fonts are a mess.
               (mimeType && (
                 mimeType.contains("font/") ||
                 mimeType.contains("/font"))) ||
               url.contains(".eot") ||
               url.contains(".ttf") ||
               url.contains(".otf") ||
               url.contains(".woff");
let isImage  = exports.isImage = ({ mimeType }) =>
               mimeType && mimeType.contains("image/");
let isMedia  = exports.isMedia = ({ mimeType }) => // Not including images.
               mimeType && (
                 mimeType.contains("audio/") ||
                 mimeType.contains("video/") ||
                 mimeType.contains("model/"));
let isFlash  = exports.isFlash = ({ url, mimeType }) => // Flash is a mess.
               (mimeType && (
                 mimeType.contains("/x-flv") ||
                 mimeType.contains("/x-shockwave-flash"))) ||
               url.contains(".swf") ||
               url.contains(".flv");
let isOther  = exports.isOther = (e) =>
               !isHtml(e) && !isCss(e) && !isJs(e) && !isXHR(e) &&
               !isFont(e) && !isImage(e) && !isMedia(e) && !isFlash(e);


/**
 * Return an abbreviated form of the provided mime type, if it exists. Otherwise,
 * just return the type.
 *
 * @param string type
 *        The mimetype string.
 * @return string
 *         The abbreviated or original mimetype.
 */
exports.abbreviateMimeType = function (type) {
  return CONTENT_MIME_TYPE_ABBREVIATIONS[type] || type;
};

/**
 * Takes an `Editor` instance and a mimeType string. If an appropriate
 * editor mode is found for the mime type, set the editor instance to use it.
 *
 * @param object editor
 *        The editor instance to set mode.
 * @param string mimeType
 *        The mime type string.
 */
exports.setEditorMode = function (editor, mimeType) {
  let mapping = Object.keys(CONTENT_MIME_TYPE_MAPPINGS).find(key => mimeType.contains(key));
  if (mapping) {
    editor.setMode(CONTENT_MIME_TYPE_MAPPINGS[mapping]);
  }
};

/**
 * Takes a model and returns the numeric form Charts.jsm expects.
 *
 * @param object model
 *        The request.
 * @return number
 *         The Charts.jsm type.
 */
exports.typeToChartType = function (model) {
  if (isHtml(model)) {
    return 0; // "html"
  } else if (isCss(model)) {
    return 1; // "css"
  } else if (isJs(model)) {
    return 2; // "js"
  } else if (isFont(model)) {
    return 4; // "fonts"
  } else if (isImage(model)) {
    return 5; // "images"
  } else if (isMedia(model)) {
    return 6; // "media"
  } else if (isFlash(model)) {
    return 7; // "flash"
  } else if (isXHR(model)) {
    // Verify XHR last, to categorize other mime types in their own blobs.
    return 3; // "xhr"
  }
  return 8; // "other"
};

