/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Shortcuts for accessing various web audio editor preferences.
 */
let Prefs = new ViewHelpers.Prefs("devtools", {
  showDeadNodes: ["Bool", "webaudioeditor.show-dead-nodes"]
});

function OptionsView () {
  this._onToggleShowDeadNodes = this._onToggleShowDeadNodes.bind(this);
}

OptionsView.prototype = {
  initialize: function () {
    this._showDeadNodes = $("#option-show-dead-nodes");
    this._showDeadNodes.setAttribute("checked", Prefs.showDeadNodes);
    this._showDeadNodes.addEventListener("click", this._onToggleShowDeadNodes);
  },

  destroy: function () {
    this._showDeadNodes.removeEventListener("click", this._onToggleShowDeadNodes);
  },

  _onToggleShowDeadNodes: function () {
    // We want the inverse of what's on the node, as the handler is called
    // before the menu item becomes "checked"
    Prefs.showDeadNodes = this._showDeadNodes.getAttribute("checked") !== "true";
  }
};
