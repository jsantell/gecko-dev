/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Functions handling the custom request view.
 */
function CustomRequestView() {
  dumpn("CustomRequestView was instantiated");
}

CustomRequestView.prototype = {
  /**
   * Initialization function, called when the network monitor is started.
   */
  initialize: function() {
    dumpn("Initializing the CustomRequestView");

    this.customPane = $("#custom-pane");
    this.sendButton = $("#custom-request-send-button");
    this.closeButton = $("#custom-request-close-button");
    this.resendButton = $("#headers-summary-resend");
    this.resendButton.hidden = false;

    this._onClose = this._onClose.bind(this);
    this._onSend = this._onSend.bind(this);
    this._onOpen = this._onOpen.bind(this);

    this.updateCustomRequestEvent = utils.getKeyWithEvent(this.onUpdate.bind(this));

    this.closeButton.addEventListener("click", this._onClose, false);
    this.sendButton.addEventListener("click", this._onSend, false);
    this.resendButton.addEventListener("click", this._onOpen, false);
    this.customPane.addEventListener("input", this.updateCustomRequest, false);
  },

  /**
   * Destruction function, called when the network monitor is closed.
   */
  destroy: function() {
    dumpn("Destroying the CustomRequestView");

    this.closeButton.removeEventListener("click", this._onClose, false);
    this.sendButton.removeEventListener("click", this._onSend, false);
    this.resendButton.removeEventListener("click", this._onOpen, false);
    this.customPane.removeEventListener("input", this.updateCustomRequest, false);
  },

  /**
   * Populates this view with the specified data.
   *
   * @param object requestModel
   *        The data source, a RequestModel instance.
   * @return object
   *        Returns a promise that resolves upon population the view.
   */
  populate: Task.async(function*(requestModel) {
    this.model = requestModel.clone();

    $("#custom-url-value").value = this.model.url;
    $("#custom-method-value").value = this.model.method;
    this.updateCustomQuery(this.model.url);

    if (this.model.requestHeaders) {
      let headers = this.model.requestHeaders.headers;
      $("#custom-headers-value").value = utils.writeHeaderText(headers);
    }
    if (this.model.requestPostData) {
      let postData = this.model.requestPostData.postData.text;
      $("#custom-postdata-value").value = yield gNetwork.getString(postData);
    }

    // Only emit the ID -- we recreate this model anyway once it comes through
    // the wire.
    window.emit(EVENTS.CUSTOMREQUESTVIEW_POPULATED, this.model.id);
  }),

  /**
   * Handle user input in the custom request form.
   *
   * @param object aField
   *        the field that the user updated.
   */
  onUpdate: function(aField) {
    let field = aField;
    let value;

    switch(aField) {
      case 'method':
        value = $("#custom-method-value").value.trim();
        this.model.method = value;
        break;
      case 'url':
        value = $("#custom-url-value").value;
        this.updateCustomQuery(value);
        this.model.url = value;
        break;
      case 'query':
        let query = $("#custom-query-value").value;
        this.updateCustomUrl(query);
        field = 'url';
        value = $("#custom-url-value").value
        this.model.url = value;
        break;
      case 'body':
        value = $("#custom-postdata-value").value;
        this.model.requestPostData = { postData: { text: value } };
        break;
      case 'headers':
        let headersText = $("#custom-headers-value").value;
        value = utils.parseHeadersText(headersText);
        this.model.requestHeaders = { headers: value };
        break;
    }
  },

  /**
   * Update the query string field based on the url.
   *
   * @param object aUrl
   *        The URL to extract query string from.
   */
  updateCustomQuery: function(aUrl) {
    let paramsArray = utils.parseQueryString(utils.nsIURL(aUrl).query);
    if (!paramsArray) {
      $("#custom-query").hidden = true;
      return;
    }
    $("#custom-query").hidden = false;
    $("#custom-query-value").value = utils.writeQueryText(paramsArray);
  },

  /**
   * Update the url based on the query string field.
   *
   * @param object aQueryText
   *        The contents of the query string field.
   */
  updateCustomUrl: function(aQueryText) {
    let params = utils.parseQueryText(aQueryText);
    let queryString = utils.writeQueryString(params);

    let url = $("#custom-url-value").value;
    let oldQuery = utils.nsIURL(url).query;
    let path = url.replace(oldQuery, queryString);

    $("#custom-url-value").value = path;
  },

  /**
   * Send a new HTTP request using the data in the custom request form.
   */
  _onSend: function() {
    let data = {
      url: this.model.url,
      method: this.model.method,
      httpVersion: this.model.httpVersion,
    };
    if (this.model.requestHeaders) {
      data.headers = this.model.requestHeaders.headers;
    }
    if (this.model.requestPostData) {
      data.body = this.model.requestPostData.postData.text;
    }

    console.log(data);
    NetMonitorController.webConsoleClient.sendHTTPRequest(data, aResponse => {
      let id = aResponse.eventActor.actor;
      console.log("SENT", id);
      window.emit(EVENTS.CUSTOM_REQUEST_SENT, this.model);
      this._onClose();
      NetMonitorView.Sidebar.toggle(false);
    });
  },

  /**
   * Switch back to details view.
   */
  _onClose: function() {
    this.model = null;
    NetMonitorView.Sidebar.showDetails();
  },

  /**
   * Switch to the custom pane.
   */
  _onOpen: function() {
    NetMonitorView.Sidebar.showCustom();
  }
};

NetMonitorView.CustomRequest = new CustomRequestView();
