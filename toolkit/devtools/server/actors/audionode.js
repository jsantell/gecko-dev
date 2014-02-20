/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cc, Ci, Cu, Cr} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
const protocol = require("devtools/server/protocol");
const { method, Arg, Option, RetVal } = protocol;

/**
 * An Audio Node actor allowing communication to a specific audio node in the
 * Audio Context graph.
 */
let AudioNodeActor = exports.AudioNodeActor = protocol.ActorClass({
  typeName: "audionode",

  /**
   * Create the Audio Node actor.
   *
   * @param DebuggerServerConnection conn
   *        The server connection.
   * @param AudioNode node
   *        The AudioNode that was created.
   */
  initialize: function (conn, node) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this.node = XPCNativeWrapper.unwrap(node);
    try {
      this.type = this.node.toString().match(/\[object (.*)\]$/)[1];
    } catch (e) {
      this.type = "";
    }
  },

  /**
   * Returns the name of the audio type.
   * Examples: "OscillatorNode", "MediaElementAudioSourceNode"
   */
  getType: method(function () {
    return this.type;
  }, {
    response: { text: RetVal("string") }
  }),

  /**
   * Returns a boolean indicating if the node is a source node,
   * like BufferSourceNode, MediaElementAudioSourceNode, OscillatorNode, etc.
   * Examples: "OscillatorNode", "MediaElementAudioSourceNode"
   */
  isSource: method(function () {
    return !!~this.type.indexOf("Source") || this.type === "OscillatorNode";
  }, {
    response: { text: RetVal("boolean") }
  }),

  /**
   * Changes a param on the audio node.
   *
   * @param String param
   *        Name of the AudioParam to change.
   * @param String value
   *        Value to change AudioParam to. Subsequently cast via `type`.
   * @param String type
   *        Datatype that `value` should be cast to.
   */
  setParam: method(function (param, value, dataType) {
    // Strip quotes because sometimes UIs include that for strings
    if (dataType === "string") {
      value = value.replace(/[\'\"]*/g, "");
    }
    try {
      if (isAudioParam(this.node, param))
        this.node[param].value = cast(value, dataType);
      else
        this.node[param] = cast(value, dataType);
      return true;
    } catch (e) {
      return false;
    }
  }, {
    request: {
      param: Arg(0, "string"),
      value: Arg(1, "string"),
      dataType: Arg(2, "string")
    },
    response: { text: RetVal("boolean") }
  }),
  
  /**
   * Gets a param on the audio node.
   *
   * @param String param
   *        Name of the AudioParam to fetch.
   */
  getParam: method(function (param) {
    let value = isAudioParam(this.node, param) ? this.node[param].value : this.node[param];
    return cast(value, "string");
  }, {
    request: {
      param: Arg(0, "string")
    },
    response: { text: RetVal("string") }
  }),
});

/**
 * Casts string `value` to specified `type`.
 *
 * @param String value
 *        The string to cast.
 * @param String type
 *        The datatype to cast `value` to.
 */
function cast (value, type) {
  if (!type || type === "string")
    return value;
  if (type === "number")
    return parseFloat(value);
  if (type === "boolean")
    return value === "true";
}

/**
 * Determines whether or not property is an AudioParam.
 *
 * @param AudioNode node
 *        An AudioNode.
 * @param String prop
 *        Property of `node` to evaluate to see if it's an AudioParam.
 * @return Boolean
 */
function isAudioParam (node, prop) {
  return /AudioParam/.test(node[prop].toString());
}
/**
 * The corresponding Front object for the AudioNodeActor.
 */
let AudioNodeFront = protocol.FrontClass(AudioNodeActor, {
  initialize: function (client, form) {
    protocol.Front.prototype.initialize.call(this, client, form);
    client.addActorPool(this);
    this.manage(this);
  }
});
