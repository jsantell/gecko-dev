/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

loader.lazyRequireGetter(this, "Services");
loader.lazyImporter(this, "gDevTools", "resource:///modules/devtools/gDevTools.jsm");


/**
 * Colors for themes taken from:
 * https://developer.mozilla.org/en-US/docs/Tools/DevToolsColors
 */

const COLORS = {
  dark: {
    /* chrome */
    tabtoolbar:          "rgba(37, 44, 51, 1)",
    toolbars:            "rgba(52, 60, 69, 1)",
    selectionbackground: "rgba(29, 79, 115, 1)",
    selectiontext:       "rgba(245, 247, 250, 1)",
    splitters:           "rgba(0, 0, 0, 1)",

    /* content */
    background:          "rgba(17, 19, 21, 1)",
    backgroundsidebar:   "rgba(24, 29, 32, 1)",
    backgroundattention: "rgba(178, 128, 37, 1)",

    /* text */
    textbody:            "rgba(143, 161, 178, 1)",
    textforeground:      "rgba(182, 186, 191, 1)",
    textcontrast:        "rgba(169, 186, 203, 1)",
    textcontent:         "rgba(143, 161, 178, 1)",
    textcontentdark:     "rgba(95, 115, 135, 1)",

    /* highlights */
    bluegrey:            "rgba(94, 136, 176, 1)",
    blue:                "rgba(70, 175, 227, 1)",
    green:               "rgba(112, 191, 83, 1)",
    lightorange:         "rgba(217, 155, 40, 1)",
    orange:              "rgba(217, 102, 41, 1)",
    pink:                "rgba(223, 128, 255, 1)",
    purple:              "rgba(107, 122, 187, 1)",
    red:                 "rgba(235, 83, 104, 1)"
  },
  light: {
    /* chrome */
    tabtoolbar:          "rgba(235, 236, 237, 1)",
    toolbars:            "rgba(240, 241, 242, 1)",
    selectionbackground: "rgba(76, 158, 217, 1)",
    selectiontext:       "rgba(245, 247, 250, 1)",
    splitters:           "rgba(170, 170, 170, 1)",

    /* content */
    background:          "rgba(252, 252, 252, 1)",
    backgroundsidebar:   "rgba(247, 247, 247, 1)",
    backgroundattention: "rgba(230, 176, 100, 1)",

    /* text */
    textbody:            "rgba(24, 25, 26, 1)",
    textforeground:      "rgba(88, 89, 89, 1)",
    textcontrast:        "rgba(41, 46, 51, 1)",
    textcontent:         "rgba(143, 161, 178, 1)",
    textcontentdark:     "rgba(102, 115, 128, 1)",

    /* highlights */
    bluegrey:            "rgba(95, 136, 176, 1)",
    blue:                "rgba(0, 136, 204, 1)",
    green:               "rgba(44, 187, 15, 1)",
    lightorange:         "rgba(217, 126, 0, 1)",
    orange:              "rgba(241, 60, 0, 1)",
    pink:                "rgba(184, 46, 229, 1)",
    purple:              "rgba(91, 95, 255, 1)",
    red:                 "rgba(237, 38, 85, 1)"
  }
};

exports.COLORS = COLORS;

/**
 * Returns the string value of the current theme,
 * like "dark" or "light".
 */
const getTheme = exports.getTheme = () => Services.prefs.getCharPref("devtools.theme");

/**
 * Returns a color indicated by `type` (like "tabtoolbar", or "red"),
 * with the ability to specify a theme, or use whatever the current theme is
 * if left unset. If theme not found, falls back to "light" theme. Returns null
 * if the type cannot be found for the theme given.
 */
const getColor = exports.getColor = (type, theme) => {
  let themeColors = COLORS[theme || getTheme()] || COLORS.light;
  return themeColors[type] || null;
};

/**
 * Mimics selecting the theme selector in the toolbox;
 * sets the preference and emits an event on gDevTools to trigger
 * the themeing.
 */
const setTheme = exports.setTheme = (newTheme) => {
  Services.prefs.setCharPref("devtools.theme", newTheme);
  gDevTools.emit("pref-changed", {
    pref: "devtools.theme",
    newValue: newTheme,
    oldValue: getTheme()
  });
};
