/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that theme utilities work

let { Cu } = devtools.require("chrome");
let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
let { getColor, getTheme, setTheme } = devtools.require("devtools/shared/theme");

function test() {
  waitForExplicitFinish();
  testGetTheme();
  testSetTheme();
  testGetColor();
  endTests();
}

function endTests() {
  gDevTools = Services = null;
  finish();
}

function testGetTheme () {
  let originalTheme = getTheme();
  ok(originalTheme, "has some theme to start with.");
  Services.prefs.setCharPref("devtools.theme", "light");
  is(getTheme(), "light", "getTheme() correctly returns light theme");
  Services.prefs.setCharPref("devtools.theme", "dark");
  is(getTheme(), "dark", "getTheme() correctly returns dark theme");
  Services.prefs.setCharPref("devtools.theme", "unknown");
  is(getTheme(), "unknown", "getTheme() correctly returns an unknown theme");
  Services.prefs.setCharPref("devtools.theme", originalTheme);
}

function testSetTheme () {
  let originalTheme = getTheme();
  setTheme("dark");
  is(Services.prefs.getCharPref("devtools.theme"), "dark", "setTheme() correctly sets dark theme.");
  setTheme("light");
  is(Services.prefs.getCharPref("devtools.theme"), "light", "setTheme() correctly sets light theme.");
  setTheme("unknown");
  is(Services.prefs.getCharPref("devtools.theme"), "unknown", "setTheme() correctly sets an  unknown theme.");
  Services.prefs.setCharPref("devtools.theme", originalTheme);
}

function testGetColor () {
  let RED_DARK = "rgba(235, 83, 104, 1)";
  let RED_LIGHT = "rgba(237, 38, 85, 1)";
  let originalTheme = getTheme();

  setTheme("dark");
  is(getColor("red"), RED_DARK, "correctly gets color for enabled theme.");
  setTheme("light");
  is(getColor("red"), RED_LIGHT, "correctly gets color for enabled theme.");
  setTheme("metal");
  is(getColor("red"), RED_LIGHT, "correctly uses light for default theme if enabled theme not found");

  is(getColor("red", "dark"), RED_DARK, "if provided and found, uses the provided theme.");
  is(getColor("red", "metal"), RED_LIGHT, "if provided and not found, defaults to light theme.");
  is(getColor("somecomponents"), null, "if a type cannot be found, should return null.");

  setTheme(originalTheme);
}
