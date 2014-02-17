/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource:///modules/devtools/SideMenuWidget.jsm");
Cu.import("resource:///modules/devtools/ViewHelpers.jsm");

const require = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
const Promise = Cu.import("resource://gre/modules/Promise.jsm", {}).Promise;
const EventEmitter = require("devtools/shared/event-emitter");
const {Tooltip} = require("devtools/shared/widgets/Tooltip");
const Editor = require("devtools/sourceeditor/editor");

// The panel's window global is an EventEmitter firing the following events:
const EVENTS = {
  // When new programs are received from the server.
  NEW_PROGRAM: "ShaderEditor:NewProgram",
  PROGRAMS_ADDED: "ShaderEditor:ProgramsAdded",

  // When the vertex and fragment sources were shown in the editor.
  SOURCES_SHOWN: "ShaderEditor:SourcesShown",

  // When a shader's source was edited and compiled via the editor.
  SHADER_COMPILED: "ShaderEditor:ShaderCompiled",

  // When the UI is reset from tab navigation
  UI_RESET: "ShaderEditor:UIReset",

  // When the editor's error markers are all removed
  EDITOR_ERROR_MARKERS_REMOVED: "ShaderEditor:EditorCleaned"
};

/**
 * The current target and the WebGL Editor front, set by this tool's host.
 */
let gToolbox, gTarget, gFront;

/**
 * Initializes the web audio editor views
 */
function startupWebAudioEditor() {
  return Promise.all([
    EventsHandler.initialize(),
    ShadersListView.initialize(),
    ShadersEditorsView.initialize()
  ]);
}

/**
 * Destroys the shader editor controller and views.
 */
function shutdownWebAudioEditor() {
  return Promise.all([
    EventsHandler.destroy(),
    ShadersListView.destroy(),
    ShadersEditorsView.destroy()
  ]);
}

/**
 * Functions handling target-related lifetime events.
 */
let EventsHandler = {
  /**
   * Listen for events emitted by the current tab target.
   */
  initialize: function() {
    this._onHostChanged = this._onHostChanged.bind(this);
    this._onTabNavigated = this._onTabNavigated.bind(this);
    this._onProgramLinked = this._onProgramLinked.bind(this);
    this._onProgramsAdded = this._onProgramsAdded.bind(this);
    gToolbox.on("host-changed", this._onHostChanged);
    gTarget.on("will-navigate", this._onTabNavigated);
    gTarget.on("navigate", this._onTabNavigated);
    gFront.on("program-linked", this._onProgramLinked);

  },

  /**
   * Remove events emitted by the current tab target.
   */
  destroy: function() {
    gToolbox.off("host-changed", this._onHostChanged);
    gTarget.off("will-navigate", this._onTabNavigated);
    gTarget.off("navigate", this._onTabNavigated);
    gFront.off("program-linked", this._onProgramLinked);
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
    switch (event) {
      case "will-navigate": {
        Task.spawn(function() {
          // Make sure the backend is prepared to handle WebGL contexts.
          gFront.setup({ reload: false });

          // Reset UI.
          ShadersListView.empty();
          $("#reload-notice").hidden = true;
          $("#waiting-notice").hidden = false;
          yield ShadersEditorsView.setText({ vs: "", fs: "" });
          $("#content").hidden = true;
        }).then(() => window.emit(EVENTS.UI_RESET));
        break;
      }
      case "navigate": {
        // Manually retrieve the list of program actors known to the server,
        // because the backend won't emit "program-linked" notifications
        // in the case of a bfcache navigation (since no new programs are
        // actually linked).
        gFront.getPrograms().then(this._onProgramsAdded);
        break;
      }
    }
  },

  /**
   * Called every time a program was linked in the debugged tab.
   */
  _onProgramLinked: function(programActor) {
    this._addProgram(programActor);
    window.emit(EVENTS.NEW_PROGRAM);
  },

  /**
   * Callback for the front's getPrograms() method.
   */
  _onProgramsAdded: function(programActors) {
    programActors.forEach(this._addProgram);
    window.emit(EVENTS.PROGRAMS_ADDED);
  },

  /**
   * Adds a program to the shaders list and unhides any modal notices.
   */
  _addProgram: function(programActor) {
    $("#waiting-notice").hidden = true;
    $("#reload-notice").hidden = true;
    $("#content").hidden = false;
    ShadersListView.addProgram(programActor);
  }
};

/**
 * Functions handling the sources UI.
 */
let WebAudioGraphView = Heritage.extend(WidgetMethods, {
  /**
   * Initialization function, called when the tool is started.
   */
  initialize: function() {
    this.widget = new SideMenuWidget(this._pane = $("#shaders-pane"), {
      showArrows: true,
      showItemCheckboxes: true
    });

    this._onProgramSelect = this._onProgramSelect.bind(this);
    this._onProgramCheck = this._onProgramCheck.bind(this);
    this._onProgramMouseEnter = this._onProgramMouseEnter.bind(this);
    this._onProgramMouseLeave = this._onProgramMouseLeave.bind(this);

    this.widget.addEventListener("select", this._onProgramSelect, false);
    this.widget.addEventListener("check", this._onProgramCheck, false);
    this.widget.addEventListener("mouseenter", this._onProgramMouseEnter, true);
    this.widget.addEventListener("mouseleave", this._onProgramMouseLeave, true);
  },

  /**
   * Destruction function, called when the tool is closed.
   */
  destroy: function() {
    this.widget.removeEventListener("select", this._onProgramSelect, false);
    this.widget.removeEventListener("check", this._onProgramCheck, false);
    this.widget.removeEventListener("mouseenter", this._onProgramMouseEnter, true);
    this.widget.removeEventListener("mouseleave", this._onProgramMouseLeave, true);
  },

  /**
   * Adds a program to this programs container.
   *
   * @param object programActor
   *        The program actor coming from the active thread.
   */
  addProgram: function(programActor) {
    if (this.hasProgram(programActor)) {
      return;
    }

    // Currently, there's no good way of differentiating between programs
    // in a way that helps humans. It will be a good idea to implement a
    // standard of allowing debuggees to add some identifiable metadata to their
    // program sources or instances.
    let label = L10N.getFormatStr("shadersList.programLabel", this.itemCount);
    let contents = document.createElement("label");
    contents.className = "plain program-item";
    contents.setAttribute("value", label);
    contents.setAttribute("crop", "start");
    contents.setAttribute("flex", "1");

    // Append a program item to this container.
    this.push([contents], {
      index: -1, /* specifies on which position should the item be appended */
      attachment: {
        label: label,
        programActor: programActor,
        checkboxState: true,
        checkboxTooltip: L10N.getStr("shadersList.blackboxLabel")
      }
    });

    // Make sure there's always a selected item available.
    if (!this.selectedItem) {
      this.selectedIndex = 0;
    }

    // Prevent this container from growing indefinitely in height when the
    // toolbox is docked to the side.
    if (gToolbox.hostType == "side" && this.itemCount == SHADERS_AUTOGROW_ITEMS) {
      this._pane.setAttribute("height", this._pane.getBoundingClientRect().height);
    }
  },

  /**
   * Returns whether a program was already added to this programs container.
   *
   * @param object programActor
   *        The program actor coming from the active thread.
   * @param boolean
   *        True if the program was added, false otherwise.
   */
  hasProgram: function(programActor) {
    return !!this.attachments.filter(e => e.programActor == programActor).length;
  },

  /**
   * The select listener for the programs container.
   */
  _onProgramSelect: function({ detail: sourceItem }) {
    if (!sourceItem) {
      return;
    }
    // The container is not empty and an actual item was selected.
    let attachment = sourceItem.attachment;

    function getShaders() {
      return Promise.all([
        attachment.vs || (attachment.vs = attachment.programActor.getVertexShader()),
        attachment.fs || (attachment.fs = attachment.programActor.getFragmentShader())
      ]);
    }
    function getSources([vertexShaderActor, fragmentShaderActor]) {
      return Promise.all([
        vertexShaderActor.getText(),
        fragmentShaderActor.getText()
      ]);
    }
    function showSources([vertexShaderText, fragmentShaderText]) {
      return ShadersEditorsView.setText({
        vs: vertexShaderText,
        fs: fragmentShaderText
      });
    }

    getShaders()
      .then(getSources)
      .then(showSources)
      .then(null, Cu.reportError);
  },

  /**
   * The check listener for the programs container.
   */
  _onProgramCheck: function({ detail: { checked }, target }) {
    let sourceItem = this.getItemForElement(target);
    let attachment = sourceItem.attachment;
    attachment.isBlackBoxed = !checked;
    attachment.programActor[checked ? "unblackbox" : "blackbox"]();
  },

  /**
   * The mouseenter listener for the programs container.
   */
  _onProgramMouseEnter: function(e) {
    let sourceItem = this.getItemForElement(e.target, { noSiblings: true });
    if (sourceItem && !sourceItem.attachment.isBlackBoxed) {
      sourceItem.attachment.programActor.highlight(HIGHLIGHT_TINT);

      if (e instanceof Event) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  },

  /**
   * The mouseleave listener for the programs container.
   */
  _onProgramMouseLeave: function(e) {
    let sourceItem = this.getItemForElement(e.target, { noSiblings: true });
    if (sourceItem && !sourceItem.attachment.isBlackBoxed) {
      sourceItem.attachment.programActor.unhighlight();

      if (e instanceof Event) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
});

/**
 * Functions for handling the AudioContext graph view
 */
let ContextView = {
  /**
   * Initialization function, called when the tool is started.
   */
  initialize: function() {
    XPCOMUtils.defineLazyGetter(this, "_editorPromises", () => new Map());
    this._vsFocused = this._onFocused.bind(this, "vs", "fs");
    this._fsFocused = this._onFocused.bind(this, "fs", "vs");
    this._vsChanged = this._onChanged.bind(this, "vs");
    this._fsChanged = this._onChanged.bind(this, "fs");
  },

  /**
   * Destruction function, called when the tool is closed.
   */
  destroy: function() {
    this._toggleListeners("off");
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
