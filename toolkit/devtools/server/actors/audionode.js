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
  setParam: method(function (param, value, type) {
    this.node[param].value = cast(value, type);
  }, {
    request: {
      param: Arg(0, "string"),
      value: Arg(1, "string"),
      type: Arg(2, "string")
    },
    oneway: true
  }),
  
  /**
   * Gets a param on the audio node.
   *
   * @param String param
   *        Name of the AudioParam to fetch.
   */
  getParam: method(function (param) {
    return cast(this.node[param].value, "string");
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
  if (type === "string")
    return value;
  if (type === "number")
    return parseFloat(value);
  if (type === "boolean")
    return value === "true";
}

/**
 * The corresponding Front object for the AudioNodeActor.
 */
let AudioNodeFront = protocol.FrontClass(AudioNodeActor, {
  initialize: function (client, form) {
    protocol.Front.prototype.initialize.call(this, client, form);
  }
});
