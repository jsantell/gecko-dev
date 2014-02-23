/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

Cu.import("resource:///modules/devtools/VariablesView.jsm");
Cu.import("resource:///modules/devtools/VariablesViewController.jsm");
const { debounce } = Cu.import("resource://gre/modules/devtools/DevToolsUtils.jsm", {});

// Globals for d3 stuff
const WIDTH = 1000;
const HEIGHT = 400;

const GENERIC_VARIABLES_VIEW_SETTINGS = {
  lazyEmpty: true,
  lazyEmptyDelay: 10, // ms
  searchEnabled: false,
  editableValueTooltip: "",
  editableNameTooltip: "",
  preventDisableOnChange: true,
  preventDescriptorModifiers: true,
  eval: () => {}
};

const NODE_PROPERTIES = {
  "OscillatorNode": {
    "type": {
      "type": "string"
    },
    "frequency": {
      "type": "number"
    },
    "detune": {
      "type": "number"
    }
  },
  "GainNode": {
    "gain": { "type": "number" }
  },
  "DelayNode": {
    "delayTime": { "type": "number" }
  },
  "AudioBufferSourceNode": {
    "buffer": { "type": "string", "readonly": true },
    "playbackRate": { "type": "number" },
    "loop": { "type": "boolean" },
    "loopStart": { "type": "number" },
    "loopEnd": { "type": "number" },
  },
  "ScriptProcessorNode": {
    "bufferSize": { "type": "number", "readonly": true }
  },
  "PannerNode": {
    "panningModel": { "type": "string" },
    "distanceModel": { "type": "string" },
    "refDistance": { "type": "number" },
    "maxDistance": { "type": "number" },
    "rolloffFactor": { "type": "number" },
    "coneInnerAngle": { "type": "number" },
    "coneOuterAngle": { "type": "number" },
    "coneOuterGain": { "type": "number" },
  },
  "ConvolverNode": {
    "buffer": { "type": "string", "readonly": true },
    "normalize": { "type": "boolean" }
  },
  "DynamicsCompressorNode": {
    "threshold": { "type": "number" },
    "knee": { "type": "number" },
    "ratio": { "type": "number" },
    "reduction": { "type": "number" },
    "attack": { "type": "number" },
    "release": { "type": "number" }
  },
  "BiquadFilterNode": {
    "type": { "type": "string" },
    "frequency": { "type": "number" },
    "Q": { "type": "number" },
    "detune": { "type": "number" },
    "gain": { "type": "number" }
  },
  "WaveShaperNode": {
    "curve": { "type": "string", "readonly": true },
    "oversample": { "type": "string", "readonly": true }
  },
  "AnalyserNode": {
    "fftSize": { "type": "number" },
    "minDecibels": { "type": "number" },
    "maxDecibels": { "type": "number" },
    "smoothingTimeConstraint": { "type": "number" },
    "frequencyBinCount": { "type": "number", "readonly": "true" },
  },
  "AudioDestinationNode": {},
  "ChannelSplitterNode": {},
  "ChannelMergerNode": {}
};

/**
 * Takes a `graphNode` (has `actor`, `id` and `type`) and returns
 * a hash of
 */
function getNodeParams (graphNode) {
  let { actor, id, type: nodeType } = graphNode;
  let definition = NODE_PROPERTIES[nodeType] || {};

  // Fetch an array of objects containing `param` and `value` properties
  return Promise.all(
    Object.keys(definition).map(param => {
      let dataType = definition[param].type;
      return actor.getParam(param).then(val => {
        console.log(param, val, dataType, definition);
        return { param: param, value: cast(val, dataType), type: dataType };
      });
    })
  );
}


/**
 * Functions handling the graph UI.
 */
let WebAudioGraphView = {
  /**
   * Initialization function, called when the tool is started.
   */
  initialize: function() {
    this._onGraphNodeClick = this._onGraphNodeClick.bind(this);
    this.draw = debounce(this.draw.bind(this), 500);
  },

  /**
   * Destruction function, called when the tool is closed.
   */
  destroy: function() {
  },

  /**
   * Called when a page is reloaded and waiting for a "start-context" event
   * and clears out old content
   */
  resetUI: function () {
    $("#reload-notice").hidden = true;
    $("#waiting-notice").hidden = false;
    $("#content").hidden = true;
    this.resetGraph();
  },

  /**
   * Called once "start-context" is fired, indicating that there is audio context
   * activity to view and inspect
   */
  showContent: function () {
    $("#reload-notice").hidden = true;
    $("#waiting-notice").hidden = true;
    $("#content").hidden = false;
    this.refresh();
  },

  refresh: function () {
    this.draw();
  },

  resetGraph: function () {
    $("#graph").innerHTML = "";
  },

  focusNode: function (actorID) {
    // Remove class "selected" from all circles
    Array.prototype.forEach.call($$("circle"), $circle => $circle.classList.remove("selected"));
    // Add to "selected"
    $("#graph-node-" + normalizeStr(actorID)).classList.add("selected");
  },

  blurNode: function (actorID) {
    $("#graph-node-" + normalizeStr(actorID)).classList.remove("selected");
  },

  /**
   * Event handlers
   */

  /**
   * Fired when a node in the svg graph is clicked. Used to handle triggering the AudioNodePane.
   *
   * @param Object graphNode
   *        The object stored in `graphNodes` which contains render information, but most importantly,
   *        the actorID under `id` property.
   */
  _onGraphNodeClick: function (graphNode) {
    WebAudioParamView.focusNode(graphNode.id);
  },

  draw: function () {
    let view = this;
    console.log('Node count: ', graphNodes.length);
    console.log('Edge count: ', graphEdges.length);
    // Clear out previous SVG information
    this.resetGraph();

    var fakeNodes = [{id: "1", type:"fakeType1" }, { id: "2", type:"faketype2"} , {id:"3", type:"faketype3"}];
    var fakeEdges = [{source:fakeNodes[0], target:fakeNodes[1]}, {source:fakeNodes[1], target:fakeNodes[2]}];


    let force = d3.layout.force()
      .nodes(graphNodes)
      .links(graphEdges)
      .size([WIDTH, HEIGHT])
      .linkDistance(100)
      .charge(-1000)
      .on("tick", tick)
      .start();

    let svg = d3.select("#graph")
      .attr("width", WIDTH)
      .attr("height", HEIGHT);

    // Per-type markers, as they don't inherit styles.
    svg.append("defs").selectAll("marker")
      .data(["enabled"])
      .enter().append("marker")
      .attr("id", function(d) { return d; })
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", -1.5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5");

    var path = svg.append("g").selectAll("path")
      .data(force.links())
      .enter().append("path")
      //.attr("class", function(d) { return "link " + d.type; })
      //.attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
      .attr("class", function(d) { return "link enabled"; })
      .attr("marker-end", function(d) { return "url(#" + "enabled" + ")"; });

    var circle = svg.append("g").selectAll("circle")
      .data(force.nodes())
      .enter().append("circle")
      .attr("r", 10)
      .attr("id", d => normalizeStr("graph-node-" + d.id))
      .on("click", this._onGraphNodeClick)
      .on("mouseover", d => view.focusNode(d.id))
      .on("mouseout", d => view.blurNode(d.id))
      .call(force.drag);

    var text = svg.append("g").selectAll("text")
      .data(force.nodes())
      .enter().append("text")
      .attr("x", 8)
      .attr("y", ".31em")
      .text(function(d) { return d.type; });

    // Use elliptical arc path segments to doubly-encode directionality.
    function tick() {
      path.attr("d", linkArc);
      circle.attr("transform", transform);
      text.attr("transform", transform);
    }
  }

};

let WebAudioParamView = {
  _paramsView: null,

  initialize: function () {
    let paramsView = this._paramsView = new VariablesView($("#web-audio-inspector-content"),
      Heritage.extend(GENERIC_VARIABLES_VIEW_SETTINGS, {
        emptyText: "Empty",
        searchPlaceholder: "empty?"
      }));
    paramsView.eval = this._onEval.bind(this);
    this.addNode = this.addNode.bind(this);
    window.on(EVENTS.CREATE_NODE, this.addNode);
  },

  destroy: function() {},

  resetUI: function () {
    this._paramsView.empty();
  },

  /**
   * Executed when an audio param is changed in the UI.
   */
  _onEval: async(function* (variable, value) {
    let ownerScope = variable.ownerView;
    let node = getGraphNodeById(ownerScope._id);
    let propName = variable.name;
    let dataType = NODE_PROPERTIES[node.type][propName].type;
    let errorMessage = yield node.actor.setParam(propName, value, dataType);
    console.log('setting PARAM', propName, errorMessage);
    if (!errorMessage) {
      ownerScope.get(propName).setGrip(cast(value, dataType));
      window.emit(EVENTS.UI_SET_PARAM, node.id, propName, value);
    } else {
      window.emit(EVENTS.UI_SET_PARAM_ERROR, node.id, propName, value);
    }
  }),

  getScopeByID: function (id) {
    let view = this._paramsView;
    for (let i = 0; i < view._store.length; i++) {
      let scope = view.getScopeAtIndex(i);
      if (scope._id === id)
        return scope;
    }
    return null;
  },

  focusNode: function (id) {
    let scope = this.getScopeByID(id);
    if (!scope) return;

    scope.focus();
    scope.expand();
  },

  _onMouseOver: function (e) {
    let $el = this;

    // Get actorID
    let match = $el.parentNode.id.match(/\(([^\)]*)\)/);
    let id;
    if (match && match.length === 2)
      id = match[1];

    // If no ID found for some reason, just get out of here
    if (!id) return;
    WebAudioGraphView.focusNode(id);
  },

  _onMouseOut: function (e) {
    let $el = this;

    // Get actorID
    let match = $el.parentNode.id.match(/\(([^\)]*)\)/);
    let id;
    if (match && match.length === 2)
      id = match[1];

    // If no ID found for some reason, just get out of here
    if (!id) return;
    WebAudioGraphView.blurNode(id);
  },

  addNode: async(function* (_, actor) {
    let graphNode = getGraphNodeById(actor.actorID);
    let type = graphNode.type;
    let actor = graphNode.actor;
    let id = graphNode.id;

    let audioParamsTitle = type + " (" + id + ")";
    let paramsView = this._paramsView;
    let paramsScopeView = paramsView.addScope(audioParamsTitle);

    paramsScopeView._id = id;
    paramsScopeView.expanded = false;

    paramsScopeView.addEventListener("mouseover", this._onMouseOver, false);
    paramsScopeView.addEventListener("mouseout", this._onMouseOut, false);

    let params = yield getNodeParams(graphNode);
    params.forEach(({ param, value, type }) => {
      let descriptor = { value: value };
      paramsScopeView.addItem(param, descriptor);
    });

    window.emit(EVENTS.UI_ADD_NODE_LIST, actor.actorID);
  }),

  removeNode: async(function* (graphNode) {

  })

}

/**
 * Strips non-alphanumeric characters and non-dashes from a string.
 */
function normalizeStr (s) {
  return s.replace(/[^a-zA-Z0-9\-]/g, "-");
}

/**
 * Casts string `value` to specified `type`.
 *
 * @param String value
 *        The string to cast.
 * @param String type
 *        The datatype to casat `value` to.
 * @return Mixed
 */
function cast (value, type) {
  if (type === "string")
    return value.replace(/[\'\"]*/, "");
  if (type === "number")
    return parseFloat(value);
  if (type === "boolean")
    return value === "true";
}

/**
 * Rendering utils
 */
function linkArc(d) {
  var dx = d.target.x - d.source.x,
  dy = d.target.y - d.source.y,
  dr = Math.sqrt(dx * dx + dy * dy);
  return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
}

function transform(d) {
  return "translate(" + d.x + "," + d.y + ")";
}
