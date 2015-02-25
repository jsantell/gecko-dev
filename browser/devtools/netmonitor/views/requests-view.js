/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { TableRenderer } = require("devtools/netmonitor/table-renderer");
const { SummaryRenderer } = require("devtools/netmonitor/summary-renderer");
const { Tooltip } = require("devtools/shared/widgets/Tooltip");
const RESIZE_REFRESH_RATE = 50; // ms
const REQUESTS_TOOLTIP_POSITION = "topcenter bottomleft";
const REQUESTS_TOOLTIP_IMAGE_MAX_DIM = 400; // px
const REQUEST_TIME_DECIMALS = 2;
const HEADERS_SIZE_DECIMALS = 3;
const CONTENT_SIZE_DECIMALS = 2;
const FREETEXT_FILTER_SEARCH_DELAY = 200; // ms

/**
 * Functions handling the requests menu (containing details about each request,
 * like status, method, file, domain, as well as a waterfall representing
 * timing imformation).
 */
function RequestsMenuView() {
  dumpn("RequestsMenuView was instantiated");

  this._onSelect = this._onSelect.bind(this);
  this._onFilterSelection = this._onFilterSelection.bind(this);
  this._onRequestUpdate = this._onRequestUpdate.bind(this);
  this._onRequestAdd = this._onRequestAdd.bind(this);
  this._onResize = this._onResize.bind(this);
  this._onSidebarToggled = this._onSidebarToggled.bind(this);
  this._onSecurityIconClick = this._onSecurityIconClick.bind(this);
  this._onURLFilter = this._onURLFilter.bind(this);
  this._onScrollToBottom = this._onScrollToBottom.bind(this);
  this.setURLFilter = this.setURLFilter.bind(this);

  this.userInputTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  EventEmitter.decorate(this);
}

RequestsMenuView.prototype = Heritage.extend(WidgetMethods, {
  /**
   * Initialization function, called when the network monitor is started.
   */
  initialize: function() {

    dumpn("Initializing the RequestsMenuView");

    this._splitter = $("#network-inspector-view-splitter");

    // Create tooltip for hovering over an image request.
    this.tooltip = new Tooltip(document, {
      closeOnEvents: [{
        emitter: $("#requests-menu-contents"),
        event: "scroll",
        useCapture: true
      }]
    });

    this.freetextFilterBox = $("#requests-menu-filter-freetext-text");

    this.tableRenderer = new TableRenderer($("#requests-menu-contents"), RequestCollection, gNetwork);
    RequestCollection.on("change", this._onRequestUpdate);
    RequestCollection.on("add", this._onRequestAdd);
    RequestCollection.on("filtered", this._onFilterUpdate);
    this.tableRenderer.on("select", this._onSelect);
    this.tableRenderer.on("scroll-to-bottom", this._onScrollToBottom);

    this.summaryRenderer = new SummaryRenderer($("#requests-menu-network-summary-label"), RequestCollection);
    Prefs.filters.forEach(type => this._onFilterSelection(type));

    this._splitter.addEventListener("mousemove", this._onResize, false);
    this.freetextFilterBox.addEventListener("input", this._onURLFilter, false);
    this.freetextFilterBox.addEventListener("command", this._onURLFilter, false);
    window.addEventListener("resize", this._onResize, false);
    window.on(EVENTS.SIDEBAR_TOGGLED, this._onSidebarToggled);
    this._onContextPerfCommand = () => NetMonitorView.toggleFrontendMode();

    this.requestsMenuSortEvent = utils.getKeyWithEvent(this.sortBy.bind(this));
    this.requestsMenuFilterEvent = utils.getKeyWithEvent(this._onFilterSelection.bind(this));
    $("#toolbar-labels").addEventListener("click", this.requestsMenuSortEvent, false);
    $("#requests-menu-footer").addEventListener("click", this.requestsMenuFilterEvent, false);

    window.once("connected", this._onConnect.bind(this));
  },

  _onConnect: function() {
    // Wait until after the actor is connected to set up the context menu,
    // as there's some feature detection involved.
    NetMonitorView.ContextMenu.initialize();

    if (NetMonitorController.supportsPerfStats) {
      $("#request-menu-context-perf").addEventListener("command", this._onContextPerfCommand, false);
      $("#requests-menu-perf-notice-button").addEventListener("command", this._onContextPerfCommand, false);
      $("#requests-menu-network-summary-button").addEventListener("command", this._onContextPerfCommand, false);
      $("#requests-menu-network-summary-label").addEventListener("click", this._onContextPerfCommand, false);
      $("#network-statistics-back-button").addEventListener("command", this._onContextPerfCommand, false);
    } else {
      $("#notice-perf-message").hidden = true;
      $("#request-menu-context-perf").hidden = true;
      $("#requests-menu-network-summary-button").hidden = true;
      $("#requests-menu-network-summary-label").hidden = true;
    }

    if (!NetMonitorController.supportsTransferredResponseSize) {
      $("#requests-menu-transferred-header-box").hidden = true;
      $("#requests-menu-item-template .requests-menu-transferred").hidden = true;
    }
  },

  /**
   * Destruction function, called when the network monitor is closed.
   */
  destroy: Task.async(function*() {
    dumpn("Destroying the SourcesView");

    Prefs.filters = RequestCollection.getFilters();

    this.tableRenderer.off("select", this._onSelect);
    this.tableRenderer.off("scroll-to-bottom", this._onScrollToBottom);
    yield this.tableRenderer.destroy();
    yield NetMonitorView.ContextMenu.destroy();

    RequestCollection.off("change", this._onRequestUpdate);
    RequestCollection.off("add", this._onRequestAdd);
    this._splitter.removeEventListener("mousemove", this._onResize, false);
    this.freetextFilterBox.removeEventListener("input", this._onURLFilter, false);
    this.freetextFilterBox.removeEventListener("command", this._onURLFilter, false);
    this.userInputTimer.cancel();
    window.removeEventListener("resize", this._onResize, false);
    window.off(EVENTS.SIDEBAR_TOGGLED, this._onSidebarToggled);

    $("#toolbar-labels").removeEventListener("click", this.requestsMenuSortEvent, false);
    $("#requests-menu-footer").removeEventListener("click", this.requestsMenuFilterEvent, false);
    $("#request-menu-context-perf").removeEventListener("command", this._onContextPerfCommand, false);

    $("#requests-menu-perf-notice-button").removeEventListener("command", this._onContextPerfCommand, false);
    $("#requests-menu-network-summary-button").removeEventListener("command", this._onContextPerfCommand, false);
    $("#requests-menu-network-summary-label").removeEventListener("click", this._onContextPerfCommand, false);
    $("#network-statistics-back-button").removeEventListener("command", this._onContextPerfCommand, false);
  }),

  /**
   * Specifies if this view may be updated lazily. Currently a proxy for
   * the table renderer.
   */
  set lazyUpdate(value) {
    this.tableRenderer.lazyUpdate = value;
  },
  get lazyUpdate() {
    return this.tableRenderer.lazyUpdate;
  },

  /**
   * Called when a Request instance's property is updated.
   */
  _onRequestUpdate: function (model, prop, value) {
    refreshNetworkDetailsPaneIfNecessary(model);
  },

  /**
   * Called when a Request instance is created. Initializes the view.
   */
  _onRequestAdd: function ({ id, cloned }) {
    $("#requests-menu-empty-notice").hidden = true;
  },

  /**
   * Called when the table emits a "select" event.
   */
  _onSelect: function (model) {
    this.selectedRequest = model;
    if (model) {
      NetMonitorView.Sidebar.showDetails();
      NetMonitorView.Sidebar.toggle(true);
    } else {
      NetMonitorView.Sidebar.toggle(false);
    }
  },

  /**
   * The following methods are used to
   * interface with the table renderer to manipulate the selected request.
   */
  selectFirstRequest: function () {
    this.tableRenderer.selectFirstRequest();
  },

  unselectRequest: function () {
    this.tableRenderer.unselectRequest();
  },

  selectRequest: function (modelOrId) {
    this.tableRenderer.selectRequest(modelOrId.id != null ? modelOrId.id : modelOrId);
  },

  selectRequestByIndex: function (index) {
    this.tableRenderer.selectRequestByIndex(index);
  },

  /**
   * Gets the currently selected request model.
   */
  getSelected: function () {
    return this.selectedRequest;
  },

  /**
   * Return current selected index. Used in tests.
   */
  getSelectedIndex: function () {
    return this.tableRenderer.getSelectedIndex();
  },

  /**
   * Used in tests. Returns the element for request at index.
   */
  getElementAtIndex: function (index) {
    return this.tableRenderer.getItemAtIndex(index).target;
  },

  /**
   * Aliases for previous ViewHelper way of selecting or
   * returning selected index.
   * Used to avoid rewriting all tests.
   * TODO update tests so this isnt needed.
   */
  set selectedIndex(val) {
    this.selectRequestByIndex(val);
  },
  get selectedIndex() {
    return this.getSelectedIndex();
  },
  getItemAtIndex: function (i) {
    // Return the model itself; not the widget with target/attachment.
    return this.tableRenderer.getItemAtIndex(i).attachment;
  },
  get itemCount() {
    return RequestCollection.length;
  },
  get visibleItems() {
    return RequestCollection.getFiltered();
  },

  /**
   * Sets the URL filter for all requests. Called after being debounced
   * by _onURLFilter.
   */
  setURLFilter: function () {
    RequestCollection.setURLFilter(this._currentFreetextFilter);
  },

  /**
   * Handles the timeout on the freetext filter textbox
   */
  _onURLFilter: function () {
    this.userInputTimer.cancel();
    this._currentFreetextFilter = this.freetextFilterBox.value || "";
    if (this._currentFreetextFilter.length === 0) {
      this.freetextFilterBox.removeAttribute("filled");
    } else {
      this.freetextFilterBox.setAttribute("filled", true);
    }
    this.userInputTimer.initWithCallback(this.setURLFilter, FREETEXT_FILTER_SEARCH_DELAY, Ci.nsITimer.TYPE_ONE_SHOT);
  },

  /**
   * Filters all network requests in this container by a specified type.
   * Sets the RequestCollection appropriately and updates the button state.
   *
   * @param string aType
   *        Either "all", "html", "css", "js", "xhr", "fonts", "images", "media"
   *        "flash" or "other".
   */
  _onFilterSelection: function (aType = "all") {
                        console.log("on filter", aType);
    if (RequestCollection.hasFilter(aType)) {
      RequestCollection.removeFilter(aType);
    } else {
      RequestCollection.addFilter(aType);
    }
  },

  /**
   * Same as `filterOn`, except that it only allows a single type exclusively.
   *
   * @param string aType
   *        @see RequestsMenuView.prototype.fitlerOn
   */
  filterOnlyOn: function(aType = "all") {
    RequestCollection.setFilter(aType);
  },

  /**
   * Updates filter buttons based on RequestCollection filter state, triggered
   * by `filtered` event on RequestCollection.
   */
  _onFilterUpdate: function () {
    for (let button of $$(".requests-menu-filter-button")) {
      if (RequestCollection.hasFilter(button.getAttribute("data-key"))) {
        button.setAttribute("checked", true);
      } else {
        button.removeAttribute("checked");
      }
    }
  },

  /**
   * Sorts all network requests in this container by a specified detail.
   *
   * @param string aType
   *        Either "status", "method", "file", "domain", "type", "transferred",
   *        "size" or "waterfall".
   */
  sortBy: function(aType = "waterfall") {
    let target = $("#requests-menu-" + aType + "-button");
    let headers = document.querySelectorAll(".requests-menu-header-button");

    for (let header of headers) {
      if (header != target) {
        header.removeAttribute("sorted");
        header.removeAttribute("tooltiptext");
      }
    }

    let direction = "";
    if (target) {
      if (target.getAttribute("sorted") == "ascending") {
        target.setAttribute("sorted", direction = "descending");
        target.setAttribute("tooltiptext", L10N.getStr("networkMenu.sortedDesc"));
      } else {
        target.setAttribute("sorted", direction = "ascending");
        target.setAttribute("tooltiptext", L10N.getStr("networkMenu.sortedAsc"));
      }
    }

    // Sorts the models themselves
    RequestCollection.sortBy(aType, direction === "descending");
  },

  /**
   * Attaches security icon click listener for the given request menu item.
   *
   * @param object item
   *        The network request item to attach the listener to.
   */
  attachSecurityIconClickListener: function ({ target }) {
    let icon = $(".requests-security-state-icon", target);
    icon.addEventListener("click", this._onSecurityIconClick);
  },

  /**
   * A handler that opens the security tab in the details view if secure or
   * broken security indicator is clicked.
   */
  _onSecurityIconClick: function(e) {
    let state = this.selectedRequest.securityState;
    if (state !== "insecure") {
      // Choose the security tab.
      NetMonitorView.NetworkDetails.widget.selectedIndex = 5;
    }
  },

  /**
   * The resize listener for this container's window.
   */
  _onResize: function(e) {
    // Allow requests to settle down first.
    setNamedTimeout(
      "resize-events", RESIZE_REFRESH_RATE, () => this.tableRenderer.refreshWaterfall(true));
  },

  /**
   * Called when the sidebar is toggled.
   */
  _onSidebarToggled: function () {
    this.refreshWaterfall(true);
  },

  /**
   * The predicate used when deciding whether a popup should be shown
   * over a request item or not.
   *
   * @param nsIDOMNode aTarget
   *        The element node currently being hovered.
   * @param object aTooltip
   *        The current tooltip instance.
   */
  _onHover: function(aTarget, aTooltip) {
    let requestItem = this.getItemForElement(aTarget);
    if (!requestItem || !requestItem.attachment.responseContent) {
      return;
    }

    let hovered = requestItem.attachment;
    let { url } = hovered;
    let { mimeType, text, encoding } = hovered.responseContent.content;

    if (mimeType && mimeType.contains("image/") && (
      aTarget.classList.contains("requests-menu-icon") ||
      aTarget.classList.contains("requests-menu-file")))
    {
      return gNetwork.getString(text).then(aString => {
        let anchor = this.$(".requests-menu-icon", requestItem.target);
        let src = "data:" + mimeType + ";" + encoding + "," + aString;
        aTooltip.setImageContent(src, { maxDim: REQUESTS_TOOLTIP_IMAGE_MAX_DIM });
        return anchor;
      });
    }
  },

  /**
   * Emitted when the TableRenderer scrolls to bottom. Pipes event
   * to this view. Used in tests.
   */
  _onScrollToBottom: function () {
                       console.log("SCROOLLL TO BOTTOM!!!");
    this.emit("scroll-to-bottom");
  },

  /**
   * Calls the table renderer's refreshWaterfall function,
   * taking an optional boolean `reset` indicating whether or not
   * the bounding box of the waterfall has changed.
   */
  refreshWaterfall: function (reset) {
    this.tableRenderer.refreshWaterfall(reset);
  },

  _splitter: null,

  _currentFreetextFilter: "",

  toString: () => "[object RequestsMenuView]"
});

/**
 * Refreshes the information displayed in the sidebar, in case this update
 * may have additional information about a request which isn't shown yet
 * in the network details pane.
 *
 * @param object aRequestItem
 *        The item to repopulate the sidebar with in case it's selected in
 *        this requests menu.
 */
function refreshNetworkDetailsPaneIfNecessary(requestModel) {
  let selected = NetMonitorView.RequestsMenu.selectedRequest;
  if (selected === requestModel) {
    NetMonitorView.Sidebar.showDetails(requestModel);
  }
}

NetMonitorView.RequestsMenu = new RequestsMenuView();
