/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { ViewHelpers, WidgetMethods } = require("resource:///modules/devtools/ViewHelpers.jsm");
const { SideMenuWidget } = require("resource:///modules/devtools/SideMenuWidget.jsm");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { PluralForm } = require("resource://gre/modules/PluralForm.jsm");
const { debounce } = require("sdk/lang/functional");
const { Class } = require("sdk/core/heritage");
const utils = require("devtools/netmonitor/utils");
const types = require("devtools/netmonitor/types");

const NET_STRINGS_URI = "chrome://browser/locale/devtools/netmonitor.properties";

const L10N = new ViewHelpers.L10N(NET_STRINGS_URI);
const SUMMARY_REFRESH_RATE = 100;
const CONTENT_SIZE_DECIMALS = 2;
const HTML_NS = "http://www.w3.org/1999/xhtml";
const EPSILON = 0.001;
const RESIZE_REFRESH_RATE = 50; // ms
const REQUESTS_REFRESH_RATE = 50; // ms
const REQUESTS_HEADERS_SAFE_BOUNDS = 30; // px
const REQUESTS_TOOLTIP_POSITION = "topcenter bottomleft";
const REQUESTS_TOOLTIP_IMAGE_MAX_DIM = 400; // px
const REQUESTS_WATERFALL_SAFE_BOUNDS = 90; // px
const REQUESTS_WATERFALL_HEADER_TICKS_MULTIPLE = 5; // ms
const REQUESTS_WATERFALL_HEADER_TICKS_SPACING_MIN = 60; // px
const REQUESTS_WATERFALL_BACKGROUND_TICKS_MULTIPLE = 5; // ms
const REQUESTS_WATERFALL_BACKGROUND_TICKS_SCALES = 3;
const REQUESTS_WATERFALL_BACKGROUND_TICKS_SPACING_MIN = 10; // px
const REQUESTS_WATERFALL_BACKGROUND_TICKS_COLOR_RGB = [128, 136, 144];
const REQUESTS_WATERFALL_BACKGROUND_TICKS_OPACITY_MIN = 32; // byte
const REQUESTS_WATERFALL_BACKGROUND_TICKS_OPACITY_ADD = 32; // byte
const REQUEST_TIME_DECIMALS = 2;
const HEADERS_SIZE_DECIMALS = 3;
const RENDER_IF_UPDATED_PROPERTIES = [
  "securityState", "status", "statusText", "contentSize", "transferredSize",
  "responseContent", "mimeType", "totalTime", "remoteAddress"
];

/**
 * Exposed API
 * To refactor this renderer, or replace with something else, the following methods and events
 * must be implemented.
 * Many of these methods are remenants of using ViewHelper widgets, and can probably be removed if
 * tests are updated to just use the request model.
 *
 * destroy() - May return a promise upon destruction complete. Must be sure to handle that after calling
 * destroy, no further action should come from here (drawing to canvas, etc)
 * refreshWaterfall(boolean) - Called from main view when timing data or a resize has occurred. Debounced here.
 * selectFirstRequest() - Selects the first visible request.
 * unselectRequest() - Unselects a request.
 * selectRequest(id) - Selects a request by ID.
 * selectRequestByIndex(i) - Selects a request by index.
 * getSelectedIndex() - Returns the currently selected index.
 * getSelected() - Returns the currently selected request (NOT the widget "item", but the attachment)
 *
 * Events:
 * - 'select' Emits the selected model.
 * - 'scroll-to-bottom' Emits when table view is scrolled to bottom via widget. Used intests.
 */
const TableRenderer = exports.TableRenderer = Class({
  implements: [WidgetMethods, EventTarget],
  initialize: function (el, requests, gNetwork) {
    this.gNetwork = gNetwork;
    this.el = el;
    this.document = this.el.ownerDocument;
    this.window = this.el.ownerDocument.defaultView;
    // Ideally, this $ would be scoped to the table, but that's not possible
    // right now due to XUL templating used around. Will have to be worked on
    // in a renderer refactor.
    this.$ = (selector, target=this.document) => target.querySelector(selector);
    this.requests = requests;

    this.lazyUpdate = true;
    this._onSelect = this._onSelect.bind(this);
    this._onScrollToBottom = this._onScrollToBottom.bind(this);

    // Bind and set up debounced renderings
    this.refreshWaterfall = debounce(this.refreshWaterfall.bind(this), RESIZE_REFRESH_RATE);

    // Bind to collection events
    this._onRequestAdd = this._onRequestAdd.bind(this);
    this._onRequestUpdate = this._onRequestUpdate.bind(this);
    this._onRequestSort = this._onRequestSort.bind(this);
    this._onRequestFilter = this._onRequestFilter.bind(this);
    this._onRequestReset = this._onRequestReset.bind(this);

    // Set up widget
    this.widget = new SideMenuWidget(this.el);

    requests.on("add", this._onRequestAdd);
    requests.on("change", this._onRequestUpdate);
    requests.on("sort", this._onRequestSort);
    requests.on("filtered", this._onRequestFilter);
    requests.on("reset", this._onRequestReset);

    // Look at RequestCollection#widgetify for use of RequestCollection
    // functions with this widget view.
    this.sortContents(requests.widgetify(requests._comparator));

    this.allowFocusOnRightClick = true;
    this.maintainSelectionVisible = true;
    this.widget.autoscrollWithAppendedItems = true;

    this.widget.addEventListener("select", this._onSelect, false);
    this.widget.addEventListener("scroll-to-bottom", this._onScrollToBottom, false);
  },

  /**
   * Destruction function, called when the network monitor is closed.
   */
  destroy: function() {
    this.requests.off("add", this._onRequestAdd);
    this.requests.off("change", this._onRequestUpdate);
    this.requests.off("sort", this._onRequestSort);
    this.requests.off("filtered", this._onRequestFilter);
    this.requests.off("reset", this._onRequestReset);
    this.widget.removeEventListener("select", this._onSelect, false);
    this.widget.removeEventListener("scroll-to-bottom", this._onScrollToBottom, false);
  },

  /**
   * Specifies if this view may be updated lazily. Should be controlled via
   * parent RequestsMenu.
   */
  set lazyUpdate(val) {
    this._lazyUpdate = val;
    // Lazy updating is disabled in some tests.
    if (val) {
      this._flushChanged = debounce(flushChanged.bind(this), REQUESTS_REFRESH_RATE);
    } else {
      this._flushChanged = flushChanged.bind(this);
    }
  },

  get lazyUpdate() {
    return this._lazyUpdate;
  },

  _onRequestSort: function () {
    // Look at RequestCollection#widgetify for use of RequestCollection
    // functions with this widget view.
    this.sortContents(this.requests.widgetify(this.requests._comparator));
    this.refreshZebra();
  },

  _onRequestFilter: function () {
    // As this is using SideBarWidget, use the filter predicate the collection
    // is using for now.
    // Look at RequestCollection#widgetify for use of RequestCollection
    // functions with this widget view.
    this.filterContents(this.requests.widgetify(this.requests.getFilterPredicate()));
    this.refreshZebra();
  },

  /**
   * When requests are reset, empty out our update queue and table.
   */
  _onRequestReset: function () {
    this._updateQueue.length = 0;
    this.empty();
  },

  /**
   * Called when a new Request instance is added to RequestCollection.
   */
  _onRequestAdd: function (model) {
    let menuView = this._createMenuView(model.method, model.url);

    let requestItem = this.push([menuView, model.id], {
      attachment: model
    });

    requestItem.target.setAttribute("data-request-id", model.id);
    requestItem.target.classList.add("request");

    // Look at RequestCollection#widgetify for use of RequestCollection
    // functions with this widget view.
    this.sortContents(this.requests.widgetify(this.requests._comparator));
    // Look at RequestCollection#widgetify for use of RequestCollection
    // functions with this widget view.
    this.filterContents(this.requests.widgetify(this.requests.getFilterPredicate()));
    this.refreshZebra();

    // Rescale all the waterfalls so that everything is visible at once.
    this.refreshWaterfall();
  },

  /**
   * Returns the currently selected index.
   */
  getSelectedIndex: function () {
    return this.selectedIndex;
  },

  /**
   * Returns the currently selected request model.
   */
  getSelected: function () {
    return this.selectedItem && this.selectedItem.attachment;
  },

  /**
   * Selects the first visible request.
   */
  selectFirstRequest: function () {
    this.selectedIndex = 0;
  },

  /**
   * Unselects a request.
   */
  unselectRequest: function () {
    this.selectedIndex = -1;
  },

  /**
   * Selects a request by ID.
   */
  selectRequest: function (id) {
    this.selectedValue = id;
  },

  /**
   * Selects a request by index.
   */
  selectRequestByIndex: function (i) {
    this.selectedIndex = i;
  },

  /**
   * Adds odd/even attributes to all the visible items in this container.
   */
  refreshZebra: function() {
    let visibleItems = this.visibleItems;

    for (let i = 0, len = visibleItems.length; i < len; i++) {
      let requestItem = visibleItems[i];
      let requestTarget = requestItem.target;

      if (i % 2 == 0) {
        requestTarget.setAttribute("even", "");
        requestTarget.removeAttribute("odd");
      } else {
        requestTarget.setAttribute("odd", "");
        requestTarget.removeAttribute("even");
      }
    }
  },

  /**
   * Called when a Request instance's property is updated.
   */
  _onRequestUpdate: function (model, prop, value) {
    var data = {};
    data[prop] = value;
    this._updateQueue.push([model.id, data]);

    let requestItem = this.getItemByValue(model.id);

    this._flushChanged();
  },

  /**
   * Adds odd/even attributes to all the visible items in this container.
   */
  refreshZebra: function() {
    let visibleItems = this.visibleItems;

    for (let i = 0, len = visibleItems.length; i < len; i++) {
      let requestItem = visibleItems[i];
      let requestTarget = requestItem.target;

      if (i % 2 == 0) {
        requestTarget.setAttribute("even", "");
        requestTarget.removeAttribute("odd");
      } else {
        requestTarget.setAttribute("odd", "");
        requestTarget.removeAttribute("even");
      }
    }
  },

  /**
   * Customization function for creating an item's UI.
   *
   * @param string aMethod
   *        Specifies the request method (e.g. "GET", "POST", etc.)
   * @param string aUrl
   *        Specifies the request's url.
   * @return nsIDOMNode
   *         The network request view.
   */
  _createMenuView: function(aMethod, aUrl) {
    let template = this.document.querySelector("#requests-menu-item-template");
    let fragment = this.document.createDocumentFragment();

    this.updateMenuView(template, "method", aMethod);
    this.updateMenuView(template, "url", aUrl);

    // Flatten the DOM by removing one redundant box (the template container).
    for (let node of template.childNodes) {
      fragment.appendChild(node.cloneNode(true));
    }

    return fragment;
  },

  /**
   * Updates the information displayed in a network request item view.
   *
   * @param object aItem
   *        The network request item in this container.
   * @param string aKey
   *        The type of information that is to be updated.
   * @param any aValue
   *        The new value to be shown.
   * @return object
   *         A promise that is resolved once the information is displayed.
   */
  updateMenuView: Task.async(function*(aItem, aKey, aValue) {
    let target = aItem.target || aItem;

    switch (aKey) {
      case "method": {
        let node = this.$(".requests-menu-method", target);
        node.setAttribute("value", aValue);
        break;
      }
      case "url": {
        let uri;
        try {
          uri = utils.nsIURL(aValue);
        } catch(e) {
          break; // User input may not make a well-formed url yet.
        }
        let nameWithQuery = utils.getUriNameWithQuery(uri);
        let hostPort = utils.getUriHostPort(uri);

        let file = this.$(".requests-menu-file", target);
        file.setAttribute("value", nameWithQuery);
        file.setAttribute("tooltiptext", nameWithQuery);

        let domain = this.$(".requests-menu-domain", target);
        domain.setAttribute("value", hostPort);
        domain.setAttribute("tooltiptext", hostPort);
        break;
      }
      case "remoteAddress": {
        let domain = this.$(".requests-menu-domain", target);
        let tooltip = `${domain.getAttribute("value")} (${aValue})`;
        domain.setAttribute("tooltiptext", tooltip);
      }
      case "securityState": {
        let tooltip = L10N.getStr("netmonitor.security.state." + aValue);
        let icon = this.$(".requests-security-state-icon", target);
        icon.classList.add("security-state-" + aValue);
        icon.setAttribute("tooltiptext", tooltip);
        break;
      }
      case "status": {
        let node = this.$(".requests-menu-status", target);
        let codeNode = this.$(".requests-menu-status-code", target);
        codeNode.setAttribute("value", aValue);
        node.setAttribute("code", aValue);
        break;
      }
      case "statusText": {
        let node = this.$(".requests-menu-status-and-method", target);
        let codeNode = this.$(".requests-menu-status-code", target);
        let statusCode = codeNode.getAttribute("value");
        node.setAttribute("tooltiptext", `${statusCode ? (statusCode + " ") : ""}${aValue}`);
        break;
      }
      case "contentSize": {
        let kb = aValue / 1024;
        let size = L10N.numberWithDecimals(kb, CONTENT_SIZE_DECIMALS);
        let node = this.$(".requests-menu-size", target);
        let text = L10N.getFormatStr("networkMenu.sizeKB", size);
        node.setAttribute("value", text);
        node.setAttribute("tooltiptext", text);
        break;
      }
      case "transferredSize": {
        let text;
        if (aValue === null) {
          text = L10N.getStr("networkMenu.sizeUnavailable");
        } else {
          let kb = aValue / 1024;
          let size = L10N.numberWithDecimals(kb, CONTENT_SIZE_DECIMALS);
          text = L10N.getFormatStr("networkMenu.sizeKB", size);
        }
        let node = this.$(".requests-menu-transferred", target);
        node.setAttribute("value", text);
        node.setAttribute("tooltiptext", text);
        break;
      }
      case "mimeType": {
        let type = utils.getAbbreviatedMimeType(aValue);
        let node = this.$(".requests-menu-type", target);
        let text = types.abbreviateMimeType(type);
        node.setAttribute("value", text);
        node.setAttribute("tooltiptext", aValue);
        break;
      }
      case "responseContent": {
        let { mimeType } = aItem.attachment;
        let { text, encoding } = aValue.content;

        if (mimeType.includes("image/")) {
          let responseBody = yield this.gNetwork.getString(text);
          let node = this.$(".requests-menu-icon", aItem.target);
          node.src = "data:" + mimeType + ";" + encoding + "," + responseBody;
          node.setAttribute("type", "thumbnail");
          node.removeAttribute("hidden");

          //window.emit(EVENTS.RESPONSE_IMAGE_THUMBNAIL_DISPLAYED);
        }
        break;
      }
      case "totalTime": {
        let node = this.$(".requests-menu-timings-total", target);
        let text = L10N.getFormatStr("networkMenu.totalMS", aValue); // integer
        node.setAttribute("value", text);
        node.setAttribute("tooltiptext", text);
        break;
      }
    }
  }),

  /**
   * Creates a waterfall representing timing information in a network request item view.
   *
   * @param object aItem
   *        The network request item in this container.
   * @param object aTimings
   *        An object containing timing information.
   */
  _createWaterfallView: function(aItem, aTimings) {
    let { target, attachment } = aItem;
    let sections = ["dns", "connect", "send", "wait", "receive"];
    // Skipping "blocked" because it doesn't work yet.

    let timingsNode = this.$(".requests-menu-timings", target);
    let timingsTotal = this.$(".requests-menu-timings-total", timingsNode);

    // Add a set of boxes representing timing information.
    for (let key of sections) {
      let width = aTimings[key];

      // Don't render anything if it surely won't be visible.
      // One millisecond == one unscaled pixel.
      if (width > 0) {
        let timingBox = this.document.createElement("hbox");
        timingBox.className = "requests-menu-timings-box " + key;
        timingBox.setAttribute("width", width);
        timingsNode.insertBefore(timingBox, timingsTotal);
      }
    }
  },

  /**
   * Rescales and redraws all the waterfall views in this container.
   *
   * @param boolean aReset
   *        True if this container's width was changed.
   */
  refreshWaterfall: function(aReset) {
    // Don't paint waterfall if there are no items in the container.
    if (!this.itemCount) {
      return;
    }

    // To avoid expensive operations like getBoundingClientRect() and
    // rebuilding the waterfall background each time a new request comes in,
    // stuff is cached. However, in certain scenarios like when the window
    // is resized, this needs to be invalidated.
    if (aReset) {
      this._cachedWaterfallWidth = 0;
    }

    // Determine the scaling to be applied to all the waterfalls so that
    // everything is visible at once. One millisecond == one unscaled pixel.
    let availableWidth = this._waterfallWidth - REQUESTS_WATERFALL_SAFE_BOUNDS;
    let longestWidth = this.requests.getDuration();
    let scale = Math.min(Math.max(availableWidth / longestWidth, EPSILON), 1);

    // Redraw and set the canvas background for each waterfall view.
    this._showWaterfallDivisionLabels(scale);
    this._drawWaterfallBackground(scale);

    // Apply CSS transforms to each waterfall in this container totalTime
    // accurately translate and resize as needed.
    for (let { target, attachment } of this) {
      let timingsNode = this.$(".requests-menu-timings", target);
      let totalNode = this.$(".requests-menu-timings-total", target);
      let direction = this.window.isRTL ? -1 : 1;

      // Render the timing information at a specific horizontal translation
      // based on the delta to the first monitored event network.
      let translateX = "translateX(" + (direction * attachment.startedDeltaMillis) + "px)";

      // Based on the total time passed until the last request, rescale
      // all the waterfalls to a reasonable size.
      let scaleX = "scaleX(" + scale + ")";

      // Certain nodes should not be scaled, even if they're children of
      // another scaled node. In this case, apply a reversed transformation.
      let revScaleX = "scaleX(" + (1 / scale) + ")";

      timingsNode.style.transform = scaleX + " " + translateX;
      totalNode.style.transform = revScaleX;
    }
  },

  /**
   * Creates the labels displayed on the waterfall header in this container.
   *
   * @param number aScale
   *        The current waterfall scale.
   */
  _showWaterfallDivisionLabels: function(aScale) {
    let container = this.$("#requests-menu-waterfall-button");
    let availableWidth = this._waterfallWidth - REQUESTS_WATERFALL_SAFE_BOUNDS;

    // Nuke all existing labels.
    while (container.hasChildNodes()) {
      container.firstChild.remove();
    }

    // Build new millisecond tick labels...
    let timingStep = REQUESTS_WATERFALL_HEADER_TICKS_MULTIPLE;
    let optimalTickIntervalFound = false;

    while (!optimalTickIntervalFound) {
      // Ignore any divisions that would end up being too close to each other.
      let scaledStep = aScale * timingStep;
      if (scaledStep < REQUESTS_WATERFALL_HEADER_TICKS_SPACING_MIN) {
        timingStep <<= 1;
        continue;
      }
      optimalTickIntervalFound = true;

      // Insert one label for each division on the current scale.
      let fragment = this.document.createDocumentFragment();
      let direction = this.window.isRTL ? -1 : 1;

      for (let x = 0; x < availableWidth; x += scaledStep) {
        let translateX = "translateX(" + ((direction * x) | 0) + "px)";
        let millisecondTime = x / aScale;

        let normalizedTime = millisecondTime;
        let divisionScale = "millisecond";

        // If the division is greater than 1 minute.
        if (normalizedTime > 60000) {
          normalizedTime /= 60000;
          divisionScale = "minute";
        }
        // If the division is greater than 1 second.
        else if (normalizedTime > 1000) {
          normalizedTime /= 1000;
          divisionScale = "second";
        }

        // Showing too many decimals is bad UX.
        if (divisionScale == "millisecond") {
          normalizedTime |= 0;
        } else {
          normalizedTime = L10N.numberWithDecimals(normalizedTime, REQUEST_TIME_DECIMALS);
        }

        let node = this.document.createElement("label");
        let text = L10N.getFormatStr("networkMenu." + divisionScale, normalizedTime);
        node.className = "plain requests-menu-timings-division";
        node.setAttribute("division-scale", divisionScale);
        node.style.transform = translateX;

        node.setAttribute("value", text);
        fragment.appendChild(node);
      }
      container.appendChild(fragment);
    }
  },

  /**
   * Creates the background displayed on each waterfall view in this container.
   *
   * @param number aScale
   *        The current waterfall scale.
   */
  _drawWaterfallBackground: function(aScale) {
    if (!this._canvas || !this._ctx) {
      this._canvas = this.document.createElementNS(HTML_NS, "canvas");
      this._ctx = this._canvas.getContext("2d");
    }
    let canvas = this._canvas;
    let ctx = this._ctx;

    // Nuke the context.
    let canvasWidth = canvas.width = this._waterfallWidth;
    let canvasHeight = canvas.height = 1; // Awww yeah, 1px, repeats on Y axis.

    // Start over.
    let imageData = ctx.createImageData(canvasWidth, canvasHeight);
    let pixelArray = imageData.data;

    let buf = new ArrayBuffer(pixelArray.length);
    let view8bit = new Uint8ClampedArray(buf);
    let view32bit = new Uint32Array(buf);

    // Build new millisecond tick lines...
    let timingStep = REQUESTS_WATERFALL_BACKGROUND_TICKS_MULTIPLE;
    let [r, g, b] = REQUESTS_WATERFALL_BACKGROUND_TICKS_COLOR_RGB;
    let alphaComponent = REQUESTS_WATERFALL_BACKGROUND_TICKS_OPACITY_MIN;
    let optimalTickIntervalFound = false;

    while (!optimalTickIntervalFound) {
      // Ignore any divisions that would end up being too close to each other.
      let scaledStep = aScale * timingStep;
      if (scaledStep < REQUESTS_WATERFALL_BACKGROUND_TICKS_SPACING_MIN) {
        timingStep <<= 1;
        continue;
      }
      optimalTickIntervalFound = true;

      // Insert one pixel for each division on each scale.
      for (let i = 1; i <= REQUESTS_WATERFALL_BACKGROUND_TICKS_SCALES; i++) {
        let increment = scaledStep * Math.pow(2, i);
        for (let x = 0; x < canvasWidth; x += increment) {
          let position = (this.window.isRTL ? canvasWidth - x : x) | 0;
          view32bit[position] = (alphaComponent << 24) | (b << 16) | (g << 8) | r;
        }
        alphaComponent += REQUESTS_WATERFALL_BACKGROUND_TICKS_OPACITY_ADD;
      }
    }

    // Flush the image data and cache the waterfall background.
    pixelArray.set(view8bit);
    ctx.putImageData(imageData, 0, 0);
    this.document.mozSetImageElement("waterfall-background", canvas);
  },

  /**
   * The selection listener for this container.
   */
  _onSelect: function({ detail: item }) {
    console.log("ON SELECT", item);
    emit(this, "select", item ? item.attachment : null);
  },

  _onScrollToBottom: function () {
                       console.log("emit on table renderer");
    emit(this, "scroll-to-bottom");
  },

  /**
   * Handle the context menu opening. Hide items if no request is selected.
   */
  _onContextShowing: function() {
    let selectedItem = this.selectedItem;

    let resendElement = this.$("#request-menu-context-resend");
    resendElement.hidden = !NetMonitorController.supportsCustomRequest ||
      !selectedItem || selectedItem.attachment.isCustom;

    let copyUrlElement = this.$("#request-menu-context-copy-url");
    copyUrlElement.hidden = !selectedItem;

    let copyAsCurlElement = this.$("#request-menu-context-copy-as-curl");
    copyAsCurlElement.hidden = !selectedItem || !selectedItem.attachment.responseContent;

    let copyImageAsDataUriElement = this.$("#request-menu-context-copy-image-as-data-uri");
    copyImageAsDataUriElement.hidden = !selectedItem ||
      !selectedItem.attachment.responseContent ||
      !selectedItem.attachment.responseContent.content.mimeType.contains("image/");

    let separator = this.$("#request-menu-context-separator");
    separator.hidden = !selectedItem;

    let newTabElement = this.$("#request-menu-context-newtab");
    newTabElement.hidden = !selectedItem;
  },

  /**
   * Gets the available waterfall width in this container.
   * @return number
   */
  get _waterfallWidth() {
    if (this._cachedWaterfallWidth == 0) {
      // Use the full document scope to select the outside container area.
      // Stopgap until this renderer can be better refactored.
      let container = this.document.querySelector("#requests-menu-toolbar");
      let waterfall = this.document.querySelector("#requests-menu-waterfall-header-box");
      let containerBounds = container.getBoundingClientRect();
      let waterfallBounds = waterfall.getBoundingClientRect();
      if (!this.window.isRTL) {
        this._cachedWaterfallWidth = containerBounds.width - waterfallBounds.left;
      } else {
        this._cachedWaterfallWidth = waterfallBounds.right;
      }
    }
    return this._cachedWaterfallWidth;
  },

  _canvas: null,
  _ctx: null,
  _cachedWaterfallWidth: 0,
  _updateQueue: []
});

/**
 * Starts adding all queued additional information about network requests.
 * Used as the source to optionally bind to TableRenderer.prototype._flushChanged
 * as debounced, or directly. Either way, must be bound to a TableRenderer instance.
 */
function flushChanged () {
  // For each queued additional information packet, get the corresponding
  // request item in the view and update it based on the specified data.
  for (let [id, data] of this._updateQueue) {
    let requestItem = this.getItemByValue(id);
    if (!requestItem) {
      // Packet corresponds to a dead request item, target navigated.
      continue;
    }

    // Each information packet may contain several { key: value } tuples of
    // network info, so update the view based on each one.
    for (let key in data) {
      let value = data[key];
      if (~RENDER_IF_UPDATED_PROPERTIES.indexOf(key)) {
        this.updateMenuView(requestItem, key, value);
      }
      if (key === "eventTimings") {
        this._createWaterfallView(requestItem, value.timings);
      }
    }
  }

  // We're done flushing all the requests, clear the update queue.
  this._updateQueue.length = 0;

  // Make sure all the requests are sorted and filtered.
  // Freshly added requests may not yet contain all the information required
  // for sorting and filtering predicates, so this is done each time the
  // network requests table is flushed (don't worry, events are drained first
  // so this doesn't happen once per network event update).

  // Look at RequestCollection#widgetify for use of RequestCollection
  // functions with this widget view.
  this.sortContents(this.requests.widgetify(this.requests._comparator));
  // Look at RequestCollection#widgetify for use of RequestCollection
  // functions with this widget view.
  this.filterContents(this.requests.widgetify(this.requests.getFilterPredicate()));
  this.refreshZebra();

  // Rescale all the waterfalls so that everything is visible at once.
  this.refreshWaterfall();
}
