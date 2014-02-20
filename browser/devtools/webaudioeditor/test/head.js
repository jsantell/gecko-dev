/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

// Enable logging for all the tests. Both the debugger server and frontend will
// be affected by this pref.
let gEnableLogging = Services.prefs.getBoolPref("devtools.debugger.log");
Services.prefs.setBoolPref("devtools.debugger.log", true);

let { Task } = Cu.import("resource://gre/modules/Task.jsm", {});
let { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
let { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
let { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
let { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
let { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

let { WebAudioFront } = devtools.require("devtools/server/actors/webaudio");
let TargetFactory = devtools.TargetFactory;
let Toolbox = devtools.Toolbox;

const EXAMPLE_URL = "http://example.com/browser/browser/devtools/webaudioeditor/test/";
const SIMPLE_CONTEXT_URL = EXAMPLE_URL + "doc_simple-context.html";
const SIMPLE_NODES_URL = EXAMPLE_URL + "doc_simple-node-creation.html";

// All tests are asynchronous.
waitForExplicitFinish();

let gToolEnabled = Services.prefs.getBoolPref("devtools.webaudioeditor.enabled");

registerCleanupFunction(() => {
  info("finish() was called, cleaning up...");
  Services.prefs.setBoolPref("devtools.debugger.log", gEnableLogging);
  Services.prefs.setBoolPref("devtools.webaudioeditor.enabled", gToolEnabled);
});

function addTab(aUrl, aWindow) {
  info("Adding tab: " + aUrl);

  let deferred = Promise.defer();
  let targetWindow = aWindow || window;
  let targetBrowser = targetWindow.gBrowser;

  targetWindow.focus();
  let tab = targetBrowser.selectedTab = targetBrowser.addTab(aUrl);
  let linkedBrowser = tab.linkedBrowser;

  linkedBrowser.addEventListener("load", function onLoad() {
    linkedBrowser.removeEventListener("load", onLoad, true);
    info("Tab added and finished loading: " + aUrl);
    deferred.resolve(tab);
  }, true);

  return deferred.promise;
}

function removeTab(aTab, aWindow) {
  info("Removing tab.");

  let deferred = Promise.defer();
  let targetWindow = aWindow || window;
  let targetBrowser = targetWindow.gBrowser;
  let tabContainer = targetBrowser.tabContainer;

  tabContainer.addEventListener("TabClose", function onClose(aEvent) {
    tabContainer.removeEventListener("TabClose", onClose, false);
    info("Tab removed and finished closing.");
    deferred.resolve();
  }, false);

  targetBrowser.removeTab(aTab);
  return deferred.promise;
}

function handleError(aError) {
  ok(false, "Got an error: " + aError.message + "\n" + aError.stack);
  finish();
}

function createCanvas() {
  return document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
}

function once(aTarget, aEventName, aUseCapture = false) {
  info("Waiting for event: '" + aEventName + "' on " + aTarget + ".");

  let deferred = Promise.defer();

  for (let [add, remove] of [
    ["on", "off"], // Use event emitter before DOM events for consistency
    ["addEventListener", "removeEventListener"],
    ["addListener", "removeListener"]
  ]) {
    if ((add in aTarget) && (remove in aTarget)) {
      aTarget[add](aEventName, function onEvent(...aArgs) {
        aTarget[remove](aEventName, onEvent, aUseCapture);
        deferred.resolve(...aArgs);
      }, aUseCapture);
      break;
    }
  }

  return deferred.promise;
}

// Hack around `once`, as that only resolves to a single (first) argument
// and discards the rest. `onceSpread` is similar, except resolves to an
// array of all of the arguments in the handler. These should be consolidated
// into the same function, but many tests will need to be changed.
function onceSpread(aTarget, aEvent) {
  let deferred = Promise.defer();
  aTarget.once(aEvent, (...args) => deferred.resolve(args));
  return deferred.promise;
}

function observe(aNotificationName, aOwnsWeak = false) {
  info("Waiting for observer notification: '" + aNotificationName + ".");

  let deferred = Promise.defer();

  Services.obs.addObserver(function onNotification(...aArgs) {
    Services.obs.removeObserver(onNotification, aNotificationName);
    deferred.resolve.apply(deferred, aArgs);
  }, aNotificationName, aOwnsWeak);

  return deferred.promise;
}

function navigateInHistory(aTarget, aDirection, aWaitForTargetEvent = "navigate") {
  executeSoon(() => content.history[aDirection]());
  return once(aTarget, aWaitForTargetEvent);
}

function navigate(aTarget, aUrl, aWaitForTargetEvent = "navigate") {
  executeSoon(() => aTarget.activeTab.navigateTo(aUrl));
  return once(aTarget, aWaitForTargetEvent);
}

function reload(aTarget, aWaitForTargetEvent = "navigate") {
  executeSoon(() => aTarget.activeTab.reload());
  return once(aTarget, aWaitForTargetEvent);
}

function test () {
  Task.spawn(spawnTest).then(finish, handleError);
}

function initBackend(aUrl) {
  info("Initializing a web audio editor front.");

  if (!DebuggerServer.initialized) {
    DebuggerServer.init(() => true);
    DebuggerServer.addBrowserActors();
  }

  return Task.spawn(function*() {
    let tab = yield addTab(aUrl);
    let target = TargetFactory.forTab(tab);
    let debuggee = target.window.wrappedJSObject;

    yield target.makeRemote();

    let front = new WebAudioFront(target.client, target.form);
    return [target, debuggee, front];
  });
}

function initWebAudioEditor(aUrl) {
  info("Initializing a web audio editor pane.");

  return Task.spawn(function*() {
    let tab = yield addTab(aUrl);
    let target = TargetFactory.forTab(tab);
    let debuggee = target.window.wrappedJSObject;

    yield target.makeRemote();

    Services.prefs.setBoolPref("devtools.webaudioeditor.enabled", true);
    let toolbox = yield gDevTools.showToolbox(target, "webaudioeditor");
    let panel = toolbox.getCurrentPanel();
    return [target, debuggee, panel];
  });
}

function teardown(aPanel) {
  info("Destroying the web audio editor.");

  return Promise.all([
    once(aPanel, "destroyed"),
    removeTab(aPanel.target.tab)
  ]);
}

// Due to web audio will fire most events synchronously back-to-back,
// and we can't yield them in a chain without missing actors, this allows
// us to listen for `n` events and return a promise resolving to them.
//
// Takes a `front` object that is an event emitter, the number of
// programs that should be listened to and waited on, and an optional
// `onAdd` function that calls with the entire actors array on program link
function getN (front, eventName, count, spread) {
  let actors = [];
  let deferred = Promise.defer();
  front.on(eventName, function onEvent (...args) {
    let actor = args[0];
    if (actors.length !== count) {
      actors.push(spread ? args : actor);
    }
    if (actors.length === count) {
      front.off(eventName, onEvent);
      deferred.resolve(actors);
    }
  });
  return deferred.promise;
}

function get (front, eventName) { return getN(front, eventName, 1); }
function get2 (front, eventName) { return getN(front, eventName, 2); }
function get3 (front, eventName) { return getN(front, eventName, 3); }
function getSpread (front, eventName) { return getN(front, eventName, 1, true); }
function get2Spread (front, eventName) { return getN(front, eventName, 2, true); }
function get3Spread (front, eventName) { return getN(front, eventName, 3, true); }
