/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * This file contains the base line graph that all Performance line graphs use.
 */

const {Cc, Ci, Cu, Cr} = require("chrome");

Cu.import("resource:///modules/devtools/Graphs.jsm");
Cu.import("resource:///modules/devtools/ViewHelpers.jsm");

const { colorUtils: { setAlpha }} = require("devtools/css-color");
const { getColor } = require("devtools/shared/theme");

loader.lazyRequireGetter(this, "ProfilerGlobal",
  "devtools/shared/profiler/global");
loader.lazyRequireGetter(this, "TimelineGlobal",
  "devtools/shared/timeline/global");
devtools.lazyRequireGetter(this, "MarkersOverview",
  "devtools/shared/timeline/markers-overview", true);

/**
 * For line graphs
 */
const HEIGHT = 35; // px
const STROKE_WIDTH = 1; // px
const DAMPEN_VALUES = 0.95;
const CLIPHEAD_LINE_COLOR = "#666";
const SELECTION_LINE_COLOR = "#555";
const SELECTION_BACKGROUND_COLOR_NAME = "highlight-blue";
const FRAMERATE_GRAPH_COLOR_NAME = "highlight-green";
const MEMORY_GRAPH_COLOR_NAME = "highlight-blue";

/**
 * For markers overview
 */
const MARKERS_GRAPH_HEADER_HEIGHT = 14; // px
const MARKERS_GRAPH_ROW_HEIGHT = 10; // px
const MARKERS_GROUP_VERTICAL_PADDING = 4; // px

/**
 * A base class for performance graphs to inherit from.
 *
 * @param nsIDOMNode parent
 *        The parent node holding the overview.
 * @param string metric
 *        The unit of measurement for this graph.
 */
function PerformanceGraph(parent, metric) {
  LineGraphWidget.call(this, parent, { metric });
  this.setTheme();
}

PerformanceGraph.prototype = Heritage.extend(LineGraphWidget.prototype, {
  strokeWidth: STROKE_WIDTH,
  dampenValuesFactor: DAMPEN_VALUES,
  fixedHeight: HEIGHT,
  clipheadLineColor: CLIPHEAD_LINE_COLOR,
  selectionLineColor: SELECTION_LINE_COLOR,
  withTooltipArrows: false,
  withFixedTooltipPositions: true,

  /**
   * Disables selection and empties this graph.
   */
  clearView: function() {
    this.selectionEnabled = false;
    this.dropSelection();
    this.setData([]);
  },

  /**
   * Sets the theme via `theme` to either "light" or "dark",
   * and updates the internal styling to match. Requires a redraw
   * to see the effects.
   */
  setTheme: function (theme) {
    theme = theme || "light";
    let mainColor = getColor(this.mainColor || "highlight-blue", theme);
    this.backgroundColor = getColor("body-background", theme);
    this.strokeColor = mainColor;
    this.backgroundGradientStart = setAlpha(mainColor, 0.2);
    this.backgroundGradientEnd = setAlpha(mainColor, 0.2);
    this.selectionBackgroundColor = setAlpha(getColor(SELECTION_BACKGROUND_COLOR_NAME, theme), 0.25);
    this.selectionStripesColor = "rgba(255, 255, 255, 0.1)";
    this.maximumLineColor = setAlpha(mainColor, 0.4);
    this.averageLineColor = setAlpha(mainColor, 0.7);
    this.minimumLineColor = setAlpha(mainColor, 0.9);
  }
});

/**
 * Constructor for the framerate graph. Inherits from PerformanceGraph.
 *
 * @param nsIDOMNode parent
 *        The parent node holding the overview.
 */
function FramerateGraph(parent) {
  PerformanceGraph.call(this, parent, ProfilerGlobal.L10N.getStr("graphs.fps"));
}

FramerateGraph.prototype = Heritage.extend(PerformanceGraph.prototype, {
  mainColor: FRAMERATE_GRAPH_COLOR_NAME,
  setData: PerformanceGraph.prototype.setDataFromTimestamps
});

exports.FramerateGraph = FramerateGraph;

/**
 * Constructor for the memory graph. Inherits from PerformanceGraph.
 *
 * @param nsIDOMNode parent
 *        The parent node holding the overview.
 */
function MemoryGraph(parent) {
  PerformanceGraph.call(this, parent, TimelineGlobal.L10N.getStr("graphs.memory"));
}

MemoryGraph.prototype = Heritage.extend(PerformanceGraph.prototype, {
  mainColor: MEMORY_GRAPH_COLOR_NAME
});

exports.MemoryGraph = MemoryGraph;

function TimelineOverview(parent, blueprint) {
  MarkersOverview.call(this, parent, blueprint);
}

TimelineOverview.prototype = Heritage.extend(MarkersOverview.prototype, {
  headerHeight: MARKERS_GRAPH_HEADER_HEIGHT,
  rowHeight: MARKERS_GRAPH_ROW_HEIGHT,
  groupPadding: MARKERS_GROUP_VERTICAL_PADDING,
});

const GRAPH_DEFINITIONS = {
  memory: {
    constructor: MemoryGraph,
    selector: "#memory-overview",
  },
  framerate: {
    constructor: FramerateGraph,
    selector: "#time-framerate",
  },
  markers: {
    constructor: TimelineOverview,
    selector: "#markers-overview",
    needsBlueprints: true,
    primaryLink: true
  }
};

/**
 * A controller for orchestrating the performance's tool overview graphs. Constructs,
 * syncs, toggles displays and defines the memory, framerate and markers view.
 *
 * @param {object} definition
 * @param {DOMElement} root
 * @param {function} getBlueprint
 * @param {function} getTheme
 */
function GraphsController ({ definition, root, getBlueprint, getTheme }) {
  this._graphs = {};
  this._definition = definition || GRAPH_DEFINITIONS;
  this._root = root;
  this._getBlueprint = getBlueprint;
  this._getTheme = getTheme;
  this._primaryLink = Object.keys(definition).filter(def => def.primaryLink)[0];
  this.$ = root.ownerDocument.querySelector.bind(root.ownerDocument);

  EventEmitter.decorate(this);
  this._onSelecting = this._onSelecting.bind(this);
}

GraphsController.prototype = {

  /**
   * Returns the corresponding graph by `graphName`.
   */
  get: function (graphName) {
    return this._graphs[graphName];
  },

  /**
   * Destroys the underlying graphs.
   */
  destroy: Task.async(function *() {
    let primary = this.getPrimaryLink();

    if (primary) {
      primary.off("selecting", this._onSelecting);
    }

    for (let graph in this._graphs) {
      yield this._graphs[graph].destroy();
    }
    this.$ = this._graphs = this._root = null;
  }),

  /**
   * Applies the theme to the underlying graphs. Optionally takes
   * a `redraw` boolean in the options to force redraw.
   */
  setTheme: function (options={}) {
    let theme = options.theme || this._getTheme();
    for (let graph in this._graphs) {
      this._graphs[graph].setTheme(theme);
      this._graphs[graph].refresh({ force: options.redraw });
    }
  },

  /**
   * Sets up the graph, if needed. Returns a promise resolving
   * to a boolean indicating whether or not the graph is enabled, and
   * sets it up if it needs.
   */
  isAvailable: Task.async(function *(graphName) {
    if (this._disabled.has(graphName)) {
      return false;
    }

    if (this.get(graphName)) {
      yield this.get(graphName).ready();
      return true;
    }

    yield this._construct(graphName);
    return true;
  }),

  enable: function (graphName, isEnabled) {
    let el = this.$(this._definition[graphName].selector);
    if (isEnabled) {
      this._disabled.delete(graphName);
      el.hidden = false;
    } else {
      this._disabled.add(graphName);
      el.hidden = true;
    }
  },

  /**
   * Disables all graphs controller by the GraphsController, and
   * also hides the root element. This is a one way switch, and used
   * when older platforms do not have any timeline data.
   */
  disableAll: function () {
    this._root.hidden = true;
  },

  /**
   * Sets a mapped selection on the graph that is the main controller
   * for keeping the graphs' selections in sync.
   */
  setMappedSelection: function (selection, { mapStart, mapEnd }) {
    this._getPrimaryLink().setMappedSelection(select, { mapStart, mapEnd });
  },

  /**
   * Drops the selection.
   */
  dropSelection: function () {
    this._getPrimaryLink().dropSelection();
  },

  /**
   * Makes sure the selection is enabled or disabled in all the graphs.
   */
  selectionEnabled: Task.async(function *(enabled) {
    for (let graph in this._graphs) {
      if (yield this.isAvailable(graph)) {
        this.get(graph).selectionEnabled = enabled;
      }
    }
  }),

  /**
   * Creates the graph `graphName` and initializes it.
   */
  _construct: Task.async(function *(graphName) {
    let def = this._definition[graphName];
    let el = this.$(def.selector);
    let blueprint = def.needsBlueprints ? this._getBlueprint() : void 0;
    let graph = this._graphs[graphName] = new def.constructor(el, blueprint);

    if (def.primaryLink) {
      graph.on("selecting", this._onSelecting);
    } else {
      CanvasGraphUtils.linkAnimation(this._getPrimaryLink(), graph);
      CanvasGraphUtils.linkSelection(this._getPrimaryLink(), graph);
    }

    yield graph.ready();

    this.setTheme();
  }),

  /**
   * Returns the main graph for this collection, that all graphs
   * are bound to for syncing and selection.
   */
  _getPrimaryLink: function () {
    return this.get(this._primaryLink);
  },

  /**
   * Emitted when a selection occurs.
   */
  _onSelecting: function () {
    this.emit("selecting");
  },
});
