/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const RequestContextView = {
  /**
   * Sets up RequestMenu's Context view. Should be called after the EVENTS.CONNECTED
   * event, so can be called from RequestMenu._onConnect, so we can get the
   * actor's traits.
   */
  initialize: function () {
    this._menu = $("#network-request-popup");
    this._separator = $("#request-menu-context-separator");
    this._cmdNewTab = $("#request-menu-context-newtab");
    this._cmdCopyURL = $("#request-menu-context-copy-url");
    this._cmdCopyCurl = $("#request-menu-context-copy-as-curl");
    this._cmdCopyImage = $("#request-menu-context-copy-image-as-data-uri");
    this._cmdResend = $("#request-menu-context-resend");

    this._menu.addEventListener("popupshowing", this._onShow, false);
    this._cmdNewTab.addEventListener("command", this._onNewTab, false);
    this._cmdCopyURL.addEventListener("command", this._onCopyURL, false);
    this._cmdCopyCurl.addEventListener("command", this._onCopyCurl, false);
    this._cmdCopyImage.addEventListener("command", this._onCopyImage, false);

    if (NetMonitorController.supportsCustomRequest) {
      this._cmdResend.addEventListener("command", this._onResend, false);
    } else {
      this._cmdResend.hidden = true;
    }
  },

  /**
   * Cleans up events.
   */
  destroy: function () {
    this._menu.removeEventListener("popupshowing", this._onShow, false);
    this._cmdNewTab.removeEventListener("command", this._onNewTab, false);
    this._cmdCopyURL.removeEventListener("command", this._onCopyURL, false);
    this._cmdCopyCurl.removeEventListener("command", this._onCopyCurl, false);
    this._cmdCopyImage.removeEventListener("command", this._onCopyImage, false);

    if (NetMonitorController.supportsCustomRequest) {
      this._cmdResend.removeEventListener("command", this._onResend, false);
    }
  },

  /**
   * Displays the appropriate options for the currently selected request
   * in the context menu.
   */
  _onShow: function () {
    let request = NetMonitorView.RequestsMenu.selectedRequest;

    this._cmdNewTab.hidden = !request;
    this._cmdCopyURL.hidden = !request;
    this._cmdCopyCurl.hidden = !request || !request.responseContent;
    this._cmdCopyImage.hidden = !request || !request.responseContent || !request.responseContent.content.mimeType.contains("image/");
    this._cmdResend.hidden = !NetMonitorController.supportsCustomRequest || !request || request.isCustom;

    this._separator.hidden = !request;
  },

  /**
   * Opens selected request in new tab.
   */
  _onNewTab: function () {
    let request = NetMonitorView.RequestsMenu.selectedRequest;
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    win.openUILinkIn(request.url, "tab", { relatedToCurrent: true });
  },

  /**
   * Copies the current request's URL to the clipboard.
   */
  _onCopyURL: function () {
    let request = NetMonitorView.RequestsMenu.selectedRequest;
    clipboardHelper.copyString(request.url, document);
  },

  /**
   * Copies the request's cURL form to the clipboard.
   */
  _onCopyCurl: Task.async(function*() {
    let request = NetMonitorView.RequestsMenu.selectedRequest;
    let curlString = yield request.toCurlString();
    clipboardHelper.copyString(curlString, document);
  }),
  
  /**
   * Copies the request's cURL form to the clipboard.
   */
  _onCopyImage: Task.async(function*() {
    let request = NetMonitorView.RequestsMenu.selectedRequest;
    let dataURIString = yield request.toDataURI();
    clipboardHelper.copyString(dataURIString, document);
  }),

  _onResend: function () {
    NetMonitorView.Sidebar.showCustom();
  }
};

NetMonitorView.ContextMenu = RequestContextView;
