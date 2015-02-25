/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const COLLAPSE_PANE_STRING = L10N.getStr("collapseDetailsPane");
const EXPAND_PANE_STRING = L10N.getStr("expandDetailsPane");

/**
 * Functions handling the sidebar details view.
 */
function SidebarView() {
  dumpn("SidebarView was instantiated");
}

SidebarView.prototype = {
  initialize: Task.async(function*() {
    this._body = $("#body");
    this._detailsPane = $("#details-pane");
    this._detailsPaneToggleButton = $("#details-pane-toggle");
    this._onTogglePanesPressed = this._onTogglePanesPressed.bind(this);
    this._onReset = this._onReset.bind(this);
    this._onAdd = this._onAdd.bind(this);

    // Set up pane
    this._detailsPane.setAttribute("width", Prefs.networkDetailsWidth);
    this._detailsPane.setAttribute("height", Prefs.networkDetailsHeight);
    this._detailsPaneToggleButton.disabled = true;
    this.toggle(false);

    this._detailsPaneToggleButton.addEventListener("mousedown", this._onTogglePanesPressed, false);
    RequestCollection.on("reset", this._onReset);
    RequestCollection.on("add", this._onAdd);
    yield NetMonitorView.NetworkDetails.initialize();
  }),

  destroy: Task.async(function*() {
             console.log("SIDEBAR****DESTRoY");
    Prefs.networkDetailsWidth = this._detailsPane.getAttribute("width");
    Prefs.networkDetailsHeight = this._detailsPane.getAttribute("height");

    this._detailsPaneToggleButton.removeEventListener("mousedown", this._onTogglePanesPressed, false);
    RequestCollection.off("reset", this._onReset);
    RequestCollection.off("add", this._onAdd);

    this._detailsPane = null;
    this._detailsPaneToggleButton = null;
    yield NetMonitorView.NetworkDetails.destroy();
  }),

  /**
   * Gets the visibility state of the network details pane.
   * @return boolean
   */
  get detailsPaneHidden() {
    return this._detailsPane.hasAttribute("pane-collapsed");
  },

  /**
   * Sets the network details pane hidden or visible.
   *
   * @param boolean isVisibleaFlags
   *        true if the pane should be shown, false to hide
   * @param number aTabIndex [optional]
   *        The index of the intended selected tab in the details pane.
   */
  toggle: function(isVisible, aTabIndex) {
    let pane = this._detailsPane;
    let button = this._detailsPaneToggleButton;

    let callback = () => window.emit(EVENTS.SIDEBAR_TOGGLED, isVisible);

    ViewHelpers.togglePane({ visible: isVisible, callback: callback }, pane);

    if (isVisible) {
      this._body.removeAttribute("pane-collapsed");
      button.removeAttribute("pane-collapsed");
      button.setAttribute("tooltiptext", COLLAPSE_PANE_STRING);
    } else {
      this._body.setAttribute("pane-collapsed", "");
      button.setAttribute("pane-collapsed", "");
      button.setAttribute("tooltiptext", EXPAND_PANE_STRING);
    }

    if (aTabIndex !== undefined) {
      $("#event-details-pane").selectedIndex = aTabIndex;
    }
  },

  /**
   * Populates this view with the specified data.
   *
   * @param object data
   *        The data source (this should be the attachment of a request item).
   * @return object
   *        Returns a promise that resolves upon population of the subview.
   */
  populate: Task.async(function*(data) {
    if (!data) {
      data = NetMonitorView.RequestsMenu.selectedRequest || {};
    }
    if (this._detailsPane.selectedIndex == 0) {
      yield NetMonitorView.CustomRequest.populate(data);
    } else {
      yield NetMonitorView.NetworkDetails.populate(data);
    }

    window.emit(EVENTS.SIDEBAR_POPULATED);
  }),

  /**
   * Shows the detailed view of the selected request.
   */
  showDetails: function () {
    this._detailsPane.selectedIndex = 1;
    this.populate();
  },

  /**
   * Shows the custom resend request view of the selected request.
   */
  showCustom: function () {
    this._detailsPane.selectedIndex = 0;
    this.populate();
  },

  /**
   * Called when RequestCollection gets a new request. Ensures the view is ready.
   */
  _onAdd: function () {
    $("#details-pane-toggle").disabled = false;
  },

  /**
   * Called when RequestCollection is reset. Resets the view.
   */
  _onReset: function () {
    this._detailsPaneToggleButton.disabled = true;
    this.toggle(false);
  },

  /**
   * Handler for the toggle button. Opens the sidebar if its closed,
   * and selects a request if none are selected. Otherwise, closes
   * the sidebar.
   */
  _onTogglePanesPressed: function () {
    if (this.detailsPaneHidden) {
      // If the sidebar is hidden, select the first request in requests view
      NetMonitorView.RequestsMenu.selectFirstRequest();
    } else {
      // If it's already visible, this means we have a request selected, so unselect it.
      NetMonitorView.RequestsMenu.unselectRequest();
    }
  }
};

NetMonitorView.Sidebar = new SidebarView();
