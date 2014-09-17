/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

// Import as different name `coreEmit`, so we don't conflict
// with the global `window` listener itself.
const { emit: coreEmit } = require("sdk/event/core");

/**
 * Representational wrapper around AudioNodeActors. Adding and destroying
 * AudioNodes should be performed through the AudioNodes collection.
 *
 * Events:
 * - `connect`: node, destinationNode, parameter
 * - `disconnect`: node
 */
const AudioNodeModel = Class({
  extends: EventTarget,

  // Will be added via AudioNodes `add`
  collection: null,

  initialize: function (actor) {
    this.actor = actor;
    this.id = actor.actorID;
    this.connections = [];
  },

  setup: Task.async(function* () {
    yield this.getType();
  }),

  // A proxy for the underlying AudioNodeActor to fetch its type
  // and subsequently assign the type to the instance.
  getType: Task.async(function* () {
    this.type = yield this.actor.getType();
    return this.type;
  }),

  connect: function (destination, param) {
    let edge = findWhere(this.connections, { destination: destination.id, param: param });

    if (!edge) {
      this.connections.push({ source: this.id, destination: destination.id, param: param });
      coreEmit(this, "connect", this, destination, param);
    }
  },

  disconnect: function () {
    this.connections.length = 0;
    coreEmit(this, "disconnect", this);
  },

  // Returns a promise that resolves to an array of objects containing
  // both a `param` name property and a `value` property.
  getParams: function () {
    return this.actor.getParams();
  },

  // Takes a `dagreD3.Digraph` object and adds this node to
  // the graph to be rendered.
  addToGraph: function (graph) {
    graph.addNode(this.id, {
      type: this.type,
      label: this.type.replace(/Node$/, ""),
      id: this.id
    });
  },

  // Takes a `dagreD3.Digraph` object and adds edges to
  // the graph to be rendered. Separate from `addToGraph`,
  // as while we depend on D3/Dagre's constraints, we cannot
  // add edges for nodes that have not yet been added to the graph.
  addEdgesToGraph: function (graph) {
    this.connections.forEach(edge => {
      let options = {
        source: this.id,
        target: edge.destination
      };

      // Only add `label` if `param` specified, as this is an AudioParam
      // connection then. `label` adds the magic to render with dagre-d3,
      // and `param` is just more explicitly the param, ignoring
      // implementation details.
      if (edge.param) {
        options.label = options.param = edge.param;
      }

      graph.addEdge(null, this.id, edge.destination, options);
    });
  }
});


/**
 * Constructor for a Collection of `AudioNodeModel` models.
 *
 * Events:
 * - `add`: node
 * - `remove`: node
 * - `connect`: node, destinationNode, parameter
 * - `disconnect`: node
 */
const AudioNodesCollection = Class({
  extends: EventTarget,

  model: AudioNodeModel,

  initialize: function () {
    this.models = new Set();
    this._onModelEvent = this._onModelEvent.bind(this);
  },

  forEach: function (fn) {
    return this.models.forEach(fn);
  },

  add: Task.async(function* (obj) {
    let node = new this.model(obj);
    node.collection = this;
    yield node.setup();

    this.models.add(node);

    node.on("*", this._onModelEvent);
    coreEmit(this, "add", node);
    return node;
  }),

  remove: function (node) {
    this.models.delete(node);
    coreEmit(this, "remove", node);
  },

  reset: function () {
    this.models.clear();
  },

  get: function (id) {
    return findWhere(this.models, { id: id });
  },

  get length() {
    return this.models.size;
  },

  // Used during tests to query state
  getInfo: function () {
    let info = {
      nodes: this.length,
      edges: 0,
      paramEdges: 0
    };

    this.models.forEach(node => {
      let paramEdgeCount = node.connections.filter(edge => edge.param).length;
      info.edges += node.connections.length - paramEdgeCount;
      info.paramEdges += paramEdgeCount;
    });
    return info;
  },

  populateGraph: function (graph) {
    this.models.forEach(node => node.addToGraph(graph));
    this.models.forEach(node => node.addEdgesToGraph(graph));
  },

  _onModelEvent: function (eventName, node, ...args) {
    if (eventName === "remove") {
      // If a `remove` event from the model, remove it
      // from the collection, and let the method handle the emitting on
      // the collection
      this.remove(node);
    } else {
      // Pipe the event to the collection
      coreEmit(this, eventName, [node].concat(args));
    }
  }
});

