/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// shared-head.js handles imports, constants, and utility functions
Services.scriptloader.loadSubScript("chrome://mochitests/content/browser/devtools/client/framework/test/shared-head.js", this);

var DEBUGGER_ROOT = URL_ROOT.replace(/shared\/source-maps\/.*/, "debugger/test/mochitest/");

function waitForSourceShown(aPanel, aUrl) {
  return waitForDebuggerEvents(aPanel, aPanel.panelWin.EVENTS.SOURCE_SHOWN).then(aSource => {
    let sourceUrl = aSource.url || aSource.introductionUrl;
    info("Source shown: " + sourceUrl);

    if (!sourceUrl.includes(aUrl)) {
      return waitForSourceShown(aPanel, aUrl);
    } else {
      ok(true, "The correct source has been shown.");
    }
  });
}

function waitForDebuggerEvents(aPanel, aEventName, aEventRepeat = 1) {
  info("Waiting for debugger event: '" + aEventName + "' to fire: " + aEventRepeat + " time(s).");

  let deferred = promise.defer();
  let panelWin = aPanel.panelWin;
  let count = 0;

  panelWin.on(aEventName, function onEvent(aEventName, ...aArgs) {
    info("Debugger event '" + aEventName + "' fired: " + (++count) + " time(s).");

    if (count == aEventRepeat) {
      ok(true, "Enough '" + aEventName + "' panel events have been fired.");
      panelWin.off(aEventName, onEvent);
      deferred.resolve.apply(deferred, aArgs);
    }
  });

  return deferred.promise;
}

function createScript (mm, url) {
  let command = `
    let script = document.createElement("script");
    script.setAttribute("src", "${url}");
    document.body.appendChild(script);
  `;
  return evalInDebuggee(mm, command);
}

function checkLocation (actual, expected, name) {
  let locationName = `${name} -- ${expected.url}:${expected.line}:${expected.column == void 0 ? "" : expected.column}`;
  is(actual.line, expected.line, `Correct line for ${locationName}`);
  is(actual.column, expected.column, `Correct column for ${locationName}`);
  is(actual.url, expected.url, `Correct url for ${locationName}`);
}
