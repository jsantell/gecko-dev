/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Utilities for interfacing with census reports from dbg.memory.takeCensus().
 */

const COARSE_TYPES = ["objects", "scripts", "strings", "other"];

/**
 * Takes a report from a census (`dbg.memory.takeCensus()`) and the breakdown
 * used to generate the census and returns a structure used to render
 * a tree to display the data.
 *
 * Returns a recursive "CensusViewData" object, looking like:
 *
 * {
 *   children: [<CensusViewData...>],
 *   name: <?String>
 *   count: <?Number>
 *   bytes: <?Number>
 * }
 *
 *
 * @param {Object} breakdown
 * @param {Object} report
 * @param {?String} name
 * @return {Object}
 */
function createCensusViewData (breakdown, report, name) {
  let result = Object.create(null);

  if (name != void 0) {
    result.name = name;
  }

  switch (breakdown.by) {
    case "internalType":
      result.children = [];
      for (let key of Object.keys(report)) {
        result.children.push(createCensusViewData(breakdown.then, report[key], key));
      }
      break;

    case "objectClass":
      result.children = [];
      for (let key of Object.keys(report)) {
        let bd = key === "other" ? breakdown.other : breakdown.then;
        result.children.push(createCensusViewData(bd, report[key], key));
      }
      break;

    case "coarseType":
      result.children = [];
      for (let type of Object.keys(breakdown).filter(type => COARSE_TYPES.indexOf(type) !== -1)) {
        result.children.push(createCensusViewData(breakdown[type], report[type], type));
      }
      break;

    case "count":
      if (breakdown.bytes === true) {
        result.bytes = report.bytes;
      }
      if (breakdown.count === true) {
        result.count = report.count;
      }
      break;
    case "default":
      throw new Error("Unknown breakdown `by` type.");
  }

  return result;
}

exports.createCensusViewData = createCensusViewData;
