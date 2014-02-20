/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource:///modules/devtools/ViewHelpers.jsm");

// Override DOM promises with Promise.jsm helpers
const { defer, all } = Cu.import("resource://gre/modules/Promise.jsm", {}).Promise;
Promise.defer = defer;
Promise.all = all;

const require = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
const EventEmitter = require("devtools/shared/event-emitter");
const {Tooltip} = require("devtools/shared/widgets/Tooltip");
const STRINGS_URI = "chrome://browser/locale/devtools/webaudioeditor.properties"
console = Cu.import("resource://gre/modules/devtools/Console.jsm").console;

// The panel's window global is an EventEmitter firing the following events:
const EVENTS = {
  // When new programs are received from the server.
  START_CONTEXT: "WebAudioEditor:StartContext",

  // On node creation, connect and disconnect.
  CREATE_NODE: "WebAudioEditor:CreateNode",
  CONNECT_NODE: "WebAudioEditor:ConnectNode",
  DISCONNECT_NODE: "WebAudioEditor:DisconnectNode",

  // On a node parameter's change.
  CHANGE_PARAM: "WebAudioEditor:ChangeParam",

  // When the UI is reset from tab navigation.
  UI_RESET: "WebAudioEditor:UIReset",
  // When a param has been changed via the UI and successfully
  // pushed via the actor to the raw audio node.
  UI_SET_PARAM: "WebAudioEditor:UISetParam",

  // When an audio node is added to the list pane
  UI_ADD_NODE_LIST: "WebAudioEditor:UIAddNodeList"
};

/**
 * The current target and the WebGL Editor front, set by this tool's host.
 */
let gToolbox, gTarget, gFront;

/**
 * Track an array of audio nodes
 */
let graphNodes = [];
let graphEdges = [];

function createGraphNode (actor) {
  let deferred = Promise.defer();
  var node = {};
  node.actor = actor;
  node.id = actor.actorID;
  return actor.getType()
    .then(type => {
      node.type = type;
      console.log("pushing node", actor.actorID);
      graphNodes.push(node);
      console.log('emitting EVENTS.CREATE_NODE', actor);
      window.emit(EVENTS.CREATE_NODE, actor);
    });
}

function createGraphEdge (sourceActor, destActor) {
  let source = actorToGraphNode(sourceActor);
  let dest = actorToGraphNode(destActor);
  graphEdges.push({ source: source, target: dest });
}

/**
 * Initializes the web audio editor views
 */
function startupWebAudioEditor() {
  return Promise.all([
    WebAudioEditorController.initialize(),
    WebAudioGraphView.initialize(),
    WebAudioParamView.initialize()
  ]);
}

/**
 * Destroys the web audio editor controller and views.
 */
function shutdownWebAudioEditor() {
  return Promise.all([
    WebAudioEditorController.destroy(),
    WebAudioGraphView.destroy(),
    WebAudioParamView.destroy()
  ]);
}

/**
 * Functions handling target-related lifetime events.
 */
let WebAudioEditorController = {
  /**
   * Listen for events emitted by the current tab target.
   */
  initialize: function() {
    this._onHostChanged = this._onHostChanged.bind(this);
    this._onTabNavigated = this._onTabNavigated.bind(this);
    gToolbox.on("host-changed", this._onHostChanged);
    gTarget.on("will-navigate", this._onTabNavigated);
    gTarget.on("navigate", this._onTabNavigated);
    gFront.on("start-context", this._onStartContext);
    gFront.on("create-node", this._onCreateNode);
    gFront.on("connect-node", this._onConnectNode);
    gFront.on("disconnect-node", this._onDisconnectNode);
    gFront.on("change-param", this._onChangeParam);
  },

  /**
   * Remove events emitted by the current tab target.
   */
  destroy: function() {
    gToolbox.off("host-changed", this._onHostChanged);
    gTarget.off("will-navigate", this._onTabNavigated);
    gTarget.off("navigate", this._onTabNavigated);
    gFront.off("start-context", this._onStartContext);
    gFront.off("create-node", this._onCreateNode);
    gFront.off("connect-node", this._onConnectNode);
    gFront.off("disconnect-node", this._onDisconnectNode);
    gFront.off("change-param", this._onChangeParam);
  },

  /**
   * Handles a host change event on the parent toolbox.
   */
  _onHostChanged: function() {
    if (gToolbox.hostType == "side") {
      $("#shaders-pane").removeAttribute("height");
    }
  },

  /**
   * Called for each location change in the debugged tab.
   */
  _onTabNavigated: function(event) {
                     console.log("on tab navigated");
    switch (event) {
      case "will-navigate": {
        Task.spawn(function() {
          // Make sure the backend is prepared to handle audio contexts.
          yield gFront.setup({ reload: false });

          // Reset UI to show "Waiting for Audio Context..." and clear out
          // current UI.
          WebAudioGraphView.resetUI();
          WebAudioParamView.resetUI();

          // Clear out stored graph
          graphNodes.length = 0;
          graphEdges.length = 0;
        }).then(() => window.emit(EVENTS.UI_RESET));
        break;
      }
      case "navigate": {
        // Case of bfcache, probably TODO
        break;
      }
    }
  },

  /**
   * Called after the first audio node is created in an audio context,
   * signaling that the audio context is being used.
   */
  _onStartContext: function() {
    WebAudioGraphView.showContent();
    window.emit(EVENTS.START_CONTEXT);
  },

  /**
   * Called when a new node is created.
   */
  _onCreateNode: function(nodeActor) {
                    console.log("_onCreateNode", nodeActor.actorID);
    createGraphNode(nodeActor).then(() => {
      WebAudioGraphView.refresh();
    });
  },

  /**
   * Called when a node is connected to another node.
   */
  _onConnectNode: function({ source: sourceActor, dest: destActor }) {
    console.log("_onConnectNode", sourceActor.actorID, destActor.actorID);
    let source = actorToGraphNode(sourceActor);
    let dest = actorToGraphNode(destActor);
    let deferred = Promise.defer();

    // Since node create and connect are probably executed back to back,
    // and the controller's `_onCreateNode` needs to look up type,
    // the edge creation could be called before the graph node is actually
    // created. This way, we can check and listen for the event before
    // adding an edge.
    console.log("CONNECT ACTORS FOUND:",source, dest);
    if (!source || !dest)
      window.on(EVENTS.CREATE_NODE, function createNodeListener (_, actor) {
        console.log("ON CREATE_NODE:", actor, actor.actorID);
        if (equalActors(sourceActor, actor))
          source = actor;
        if (equalActors(destActor, actor))
          dest = actor;
        if (source && dest) {
          window.off(EVENTS.CREATE_NODE, createNodeListener);
          deferred.resolve();
        }
      });
    else
      deferred.resolve();

    deferred.promise.then(() => {
      createGraphEdge(sourceActor, destActor);
      WebAudioGraphView.refresh();
      window.emit(EVENTS.CONNECT_NODE, sourceActor, destActor);
    });
  },
  
  /**
   * Called when a node is disconnected.
   */
  _onDisconnectNode: function(nodeActor) {
    removeGraphEdge(nodeActor);
    WebAudioGraphView.refresh();
    window.emit(EVENTS.DISCONNECT_NODE, nodeActor);
  },
  
  /**
   * Called when a node param is changed.
   */
  _onChangeParam: function({ actor: nodeActor, param, value }) {
    window.emit(EVENTS.CHANGE_PARAM, nodeActor, param, value);
  }
};

/**
 * Convenient way of emitting events from the panel window.
 */
EventEmitter.decorate(this);

/**
 * DOM query helper.
 */
function $(selector, target = document) target.querySelector(selector);

/**
 * Compare `actorID` between two actors to determine if they're corresponding
 * to the same underlying actor.
 */
function equalActors (actor1, actor2) {
  return actor1.actorID === actor2.actorID;
}

function actorToGraphNode (actor) {
  for (let i = 0; i < graphNodes.length; i++) {
    if (equalActors(graphNodes[i].actor, actor))
      return graphNodes[i];
  }
  return null;
}

function getGraphNodeById (id) {
  return actorToGraphNode({ actorID: id });
}

/**
 * TODO: Use as of now, unlanded Task.async
 */
function async (fn) {
  return function (...args) {
    return Task.spawn(fn.apply(this, args));
  };
}
