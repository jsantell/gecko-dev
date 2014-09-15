/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Services = require("Services");
const { PrefsTarget } = require("sdk/preferences/event-target");

function destroyOnPrefDisabled (toolActor, prefName) {
  let branchName = "devtools." + prefName + ".";

  console.log("LISTENING TO", branchName);
  let target = PrefsTarget({ branchName: branchName });

  target.on("enabled", listener);

  function listener (eventName) {
    console.log("LISTENER!", arguments);
    let isEnabled = Services.prefs.getBoolPref(branchName + "enabled");
    console.log(isEnabled);
    if (!isEnabled) {
      toolActor.destroy(toolActor.conn);
    }
    target.off("enabled", listener);
  }
}

exports.destroyOnPrefDisabled = destroyOnPrefDisabled;
