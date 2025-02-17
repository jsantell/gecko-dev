/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/DOMRequestHelper.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
  "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");

XPCOMUtils.defineLazyServiceGetter(this, "tm",
  "@mozilla.org/thread-manager;1", "nsIThreadManager");

/*
 * A WeakMap to map input method iframe window to
 * it's active status, kbID, and ipcHelper.
 */
let WindowMap = {
  // WeakMap of <window, object> pairs.
  _map: null,

  /*
   * Set the object associated to the window and return it.
   */
  _getObjForWin: function(win) {
    if (!this._map) {
      this._map = new WeakMap();
    }
    if (this._map.has(win)) {
      return this._map.get(win);
    } else {
      let obj = {
        active: false,
        kbID: undefined,
        ipcHelper: null
      };
      this._map.set(win, obj);

      return obj;
    }
  },

  /*
   * Check if the given window is active.
   */
  isActive: function(win) {
    if (!this._map || !win) {
      return false;
    }

    return this._getObjForWin(win).active;
  },

  /*
   * Set the active status of the given window.
   */
  setActive: function(win, isActive) {
    if (!win) {
      return;
    }
    let obj = this._getObjForWin(win);
    obj.active = isActive;
  },

  /*
   * Get the keyboard ID (assigned by Keyboard.jsm) of the given window.
   */
  getKbID: function(win) {
    if (!this._map || !win) {
      return undefined;
    }

    let obj = this._getObjForWin(win);
    return obj.kbID;
  },

  /*
   * Set the keyboard ID (assigned by Keyboard.jsm) of the given window.
   */
  setKbID: function(win, kbID) {
    if (!win) {
      return;
    }
    let obj = this._getObjForWin(win);
    obj.kbID = kbID;
  },

  /*
   * Get InputContextDOMRequestIpcHelper instance attached to this window.
   */
  getInputContextIpcHelper: function(win) {
    if (!win) {
      return;
    }
    let obj = this._getObjForWin(win);
    if (!obj.ipcHelper) {
      obj.ipcHelper = new InputContextDOMRequestIpcHelper(win);
    }
    return obj.ipcHelper;
  },

  /*
   * Unset InputContextDOMRequestIpcHelper instance.
   */
  unsetInputContextIpcHelper: function(win) {
    if (!win) {
      return;
    }
    let obj = this._getObjForWin(win);
    if (!obj.ipcHelper) {
      return;
    }
    obj.ipcHelper = null;
  }
};

let cpmmSendAsyncMessageWithKbID = function (self, msg, data) {
  data.kbID = WindowMap.getKbID(self._window);
  cpmm.sendAsyncMessage(msg, data);
};

/**
 * ==============================================
 * InputMethodManager
 * ==============================================
 */
function MozInputMethodManager(win) {
  this._window = win;
}

MozInputMethodManager.prototype = {
  _supportsSwitching: false,
  _window: null,

  classID: Components.ID("{7e9d7280-ef86-11e2-b778-0800200c9a66}"),

  QueryInterface: XPCOMUtils.generateQI([]),

  showAll: function() {
    if (!WindowMap.isActive(this._window)) {
      return;
    }
    cpmmSendAsyncMessageWithKbID(this, 'Keyboard:ShowInputMethodPicker', {});
  },

  next: function() {
    if (!WindowMap.isActive(this._window)) {
      return;
    }
    cpmmSendAsyncMessageWithKbID(this, 'Keyboard:SwitchToNextInputMethod', {});
  },

  supportsSwitching: function() {
    if (!WindowMap.isActive(this._window)) {
      return false;
    }
    return this._supportsSwitching;
  },

  hide: function() {
    if (!WindowMap.isActive(this._window)) {
      return;
    }
    cpmmSendAsyncMessageWithKbID(this, 'Keyboard:RemoveFocus', {});
  }
};

/**
 * ==============================================
 * InputMethod
 * ==============================================
 */
function MozInputMethod() { }

MozInputMethod.prototype = {
  __proto__: DOMRequestIpcHelper.prototype,

  _inputcontext: null,
  _wrappedInputContext: null,
  _layouts: {},
  _window: null,

  classID: Components.ID("{4607330d-e7d2-40a4-9eb8-43967eae0142}"),

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIDOMGlobalPropertyInitializer,
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  init: function mozInputMethodInit(win) {
    this._window = win;
    this._mgmt = new MozInputMethodManager(win);
    this.innerWindowID = win.QueryInterface(Ci.nsIInterfaceRequestor)
                            .getInterface(Ci.nsIDOMWindowUtils)
                            .currentInnerWindowID;

    Services.obs.addObserver(this, "inner-window-destroyed", false);

    cpmm.addWeakMessageListener('Keyboard:Focus', this);
    cpmm.addWeakMessageListener('Keyboard:Blur', this);
    cpmm.addWeakMessageListener('Keyboard:SelectionChange', this);
    cpmm.addWeakMessageListener('Keyboard:GetContext:Result:OK', this);
    cpmm.addWeakMessageListener('Keyboard:LayoutsChange', this);
    cpmm.addWeakMessageListener('InputRegistry:Result:OK', this);
    cpmm.addWeakMessageListener('InputRegistry:Result:Error', this);
  },

  uninit: function mozInputMethodUninit() {
    this._window = null;
    this._mgmt = null;

    cpmm.removeWeakMessageListener('Keyboard:Focus', this);
    cpmm.removeWeakMessageListener('Keyboard:Blur', this);
    cpmm.removeWeakMessageListener('Keyboard:SelectionChange', this);
    cpmm.removeWeakMessageListener('Keyboard:GetContext:Result:OK', this);
    cpmm.removeWeakMessageListener('Keyboard:LayoutsChange', this);
    cpmm.removeWeakMessageListener('InputRegistry:Result:OK', this);
    cpmm.removeWeakMessageListener('InputRegistry:Result:Error', this);
    this.setActive(false);
  },

  receiveMessage: function mozInputMethodReceiveMsg(msg) {
    if (!msg.name.startsWith('InputRegistry') &&
        !WindowMap.isActive(this._window)) {
      return;
    }

    let data = msg.data;
    let resolver = ('requestId' in data) ?
      this.takePromiseResolver(data.requestId) : null;

    switch(msg.name) {
      case 'Keyboard:Focus':
        // XXX Bug 904339 could receive 'text' event twice
        this.setInputContext(data);
        break;
      case 'Keyboard:Blur':
        this.setInputContext(null);
        break;
      case 'Keyboard:SelectionChange':
        if (this.inputcontext) {
          this._inputcontext.updateSelectionContext(data, false);
        }
        break;
      case 'Keyboard:GetContext:Result:OK':
        this.setInputContext(data);
        break;
      case 'Keyboard:LayoutsChange':
        this._layouts = data;
        break;

      case 'InputRegistry:Result:OK':
        resolver.resolve();

        break;

      case 'InputRegistry:Result:Error':
        resolver.reject(data.error);

        break;
    }
  },

  observe: function mozInputMethodObserve(subject, topic, data) {
    let wId = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
    if (wId == this.innerWindowID)
      this.uninit();
  },

  get mgmt() {
    return this._mgmt;
  },

  get inputcontext() {
    if (!WindowMap.isActive(this._window)) {
      return null;
    }
    return this._wrappedInputContext;
  },

  set oninputcontextchange(handler) {
    this.__DOM_IMPL__.setEventHandler("oninputcontextchange", handler);
  },

  get oninputcontextchange() {
    return this.__DOM_IMPL__.getEventHandler("oninputcontextchange");
  },

  setInputContext: function mozKeyboardContextChange(data) {
    if (this._inputcontext) {
      this._inputcontext.destroy();
      this._inputcontext = null;
      this._wrappedInputContext = null;
      this._mgmt._supportsSwitching = false;
    }

    if (data) {
      this._mgmt._supportsSwitching = this._layouts[data.inputType] ?
        this._layouts[data.inputType] > 1 :
        false;

      this._inputcontext = new MozInputContext(data);
      this._inputcontext.init(this._window);
      // inputcontext will be exposed as a WebIDL object. Create its
      // content-side object explicitly to avoid Bug 1001325.
      this._wrappedInputContext =
        this._window.MozInputContext._create(this._window, this._inputcontext);
    }

    let event = new this._window.Event("inputcontextchange",
                                       Cu.cloneInto({}, this._window));
    this.__DOM_IMPL__.dispatchEvent(event);
  },

  setActive: function mozInputMethodSetActive(isActive) {
    if (WindowMap.isActive(this._window) === isActive) {
      return;
    }

    WindowMap.setActive(this._window, isActive);

    if (isActive) {
      // Activate current input method.
      // If there is already an active context, then this will trigger
      // a GetContext:Result:OK event, and we can initialize ourselves.
      // Otherwise silently ignored.

      // get keyboard ID from Keyboard.jsm,
      // or if we already have it, get it from our map
      // Note: if we need to get it from Keyboard.jsm,
      // we have to use a synchronous message
      var kbID = WindowMap.getKbID(this._window);
      if (kbID) {
        cpmmSendAsyncMessageWithKbID(this, 'Keyboard:Register', {});
      } else {
        let res = cpmm.sendSyncMessage('Keyboard:Register', {});
        WindowMap.setKbID(this._window, res[0]);
      }

      cpmmSendAsyncMessageWithKbID(this, 'Keyboard:GetContext', {});
    } else {
      // Deactive current input method.
      cpmmSendAsyncMessageWithKbID(this, 'Keyboard:Unregister', {});
      if (this._inputcontext) {
        this.setInputContext(null);
      }
    }
  },

  addInput: function(inputId, inputManifest) {
    return this.createPromiseWithId(function(resolverId) {
      let appId = this._window.document.nodePrincipal.appId;

      cpmm.sendAsyncMessage('InputRegistry:Add', {
        requestId: resolverId,
        inputId: inputId,
        inputManifest: inputManifest,
        appId: appId
      });
    }.bind(this));
  },

  removeInput: function(inputId) {
    return this.createPromiseWithId(function(resolverId) {
      let appId = this._window.document.nodePrincipal.appId;

      cpmm.sendAsyncMessage('InputRegistry:Remove', {
        requestId: resolverId,
        inputId: inputId,
        appId: appId
      });
    }.bind(this));
  },

  setValue: function(value) {
    cpmm.sendAsyncMessage('System:SetValue', {
      'value': value
    });
  },

  setSelectedOption: function(index) {
    cpmm.sendAsyncMessage('System:SetSelectedOption', {
      'index': index
    });
  },

  setSelectedOptions: function(indexes) {
    cpmm.sendAsyncMessage('System:SetSelectedOptions', {
      'indexes': indexes
    });
  },

  removeFocus: function() {
    cpmm.sendAsyncMessage('System:RemoveFocus', {});
  }
};

 /**
 * ==============================================
 * InputContextDOMRequestIpcHelper
 * ==============================================
 */
function InputContextDOMRequestIpcHelper(win) {
  this.initDOMRequestHelper(win,
    ["Keyboard:GetText:Result:OK",
     "Keyboard:GetText:Result:Error",
     "Keyboard:SetSelectionRange:Result:OK",
     "Keyboard:ReplaceSurroundingText:Result:OK",
     "Keyboard:SendKey:Result:OK",
     "Keyboard:SendKey:Result:Error",
     "Keyboard:SetComposition:Result:OK",
     "Keyboard:EndComposition:Result:OK",
     "Keyboard:SequenceError"]);
}

InputContextDOMRequestIpcHelper.prototype = {
  __proto__: DOMRequestIpcHelper.prototype,
  _inputContext: null,

  attachInputContext: function(inputCtx) {
    if (this._inputContext) {
      throw new Error("InputContextDOMRequestIpcHelper: detach the context first.");
    }

    this._inputContext = inputCtx;
  },

  // Unset ourselves when the window is destroyed.
  uninit: function() {
    WindowMap.unsetInputContextIpcHelper(this._window);
  },

  detachInputContext: function() {
    // All requests that are still pending need to be invalidated
    // because the context is no longer valid.
    this.forEachPromiseResolver(k => {
      this.takePromiseResolver(k).reject("InputContext got destroyed");
    });

    this._inputContext = null;
  },

  receiveMessage: function(msg) {
    if (!this._inputContext) {
      dump('InputContextDOMRequestIpcHelper received message without context attached.\n');
      return;
    }

    this._inputContext.receiveMessage(msg);
  }
};

 /**
 * ==============================================
 * InputContext
 * ==============================================
 */
function MozInputContext(ctx) {
  this._context = {
    type: ctx.type,
    inputType: ctx.inputType,
    inputMode: ctx.inputMode,
    lang: ctx.lang,
    selectionStart: ctx.selectionStart,
    selectionEnd: ctx.selectionEnd,
    textBeforeCursor: ctx.textBeforeCursor,
    textAfterCursor: ctx.textAfterCursor
  };

  this._contextId = ctx.contextId;
}

MozInputContext.prototype = {
  _window: null,
  _context: null,
  _contextId: -1,
  _ipcHelper: null,

  classID: Components.ID("{1e38633d-d08b-4867-9944-afa5c648adb6}"),

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  init: function ic_init(win) {
    this._window = win;

    this._ipcHelper = WindowMap.getInputContextIpcHelper(win);
    this._ipcHelper.attachInputContext(this);
  },

  destroy: function ic_destroy() {
    // A consuming application might still hold a cached version of
    // this object. After destroying all methods will throw because we
    // cannot create new promises anymore, but we still hold
    // (outdated) information in the context. So let's clear that out.
    for (var k in this._context) {
      if (this._context.hasOwnProperty(k)) {
        this._context[k] = null;
      }
    }

    this._ipcHelper.detachInputContext();
    this._ipcHelper = null;

    this._window = null;
  },

  receiveMessage: function ic_receiveMessage(msg) {
    if (!msg || !msg.json) {
      dump('InputContext received message without data\n');
      return;
    }

    let json = msg.json;
    let resolver = this._ipcHelper.takePromiseResolver(json.requestId);

    if (!resolver) {
      dump('InputContext received invalid requestId.\n');
      return;
    }

    // Update context first before resolving promise to avoid race condition
    if (json.selectioninfo) {
      this.updateSelectionContext(json.selectioninfo, true);
    }

    switch (msg.name) {
      case "Keyboard:SendKey:Result:OK":
        resolver.resolve(true);
        break;
      case "Keyboard:SendKey:Result:Error":
        resolver.reject(json.error);
        break;
      case "Keyboard:GetText:Result:OK":
        resolver.resolve(json.text);
        break;
      case "Keyboard:GetText:Result:Error":
        resolver.reject(json.error);
        break;
      case "Keyboard:SetSelectionRange:Result:OK":
      case "Keyboard:ReplaceSurroundingText:Result:OK":
        resolver.resolve(
          Cu.cloneInto(json.selectioninfo, this._window));
        break;
      case "Keyboard:SequenceError":
        // Occurs when a new element got focus, but the inputContext was
        // not invalidated yet...
        resolver.reject("InputContext has expired");
        break;
      case "Keyboard:SetComposition:Result:OK": // Fall through.
      case "Keyboard:EndComposition:Result:OK":
        resolver.resolve(true);
        break;
      default:
        dump("Could not find a handler for " + msg.name);
        resolver.reject();
        break;
    }
  },

  updateSelectionContext: function ic_updateSelectionContext(ctx, ownAction) {
    if (!this._context) {
      return;
    }

    let selectionDirty = this._context.selectionStart !== ctx.selectionStart ||
          this._context.selectionEnd !== ctx.selectionEnd;
    let surroundDirty = this._context.textBeforeCursor !== ctx.textBeforeCursor ||
          this._context.textAfterCursor !== ctx.textAfterCursor;

    this._context.selectionStart = ctx.selectionStart;
    this._context.selectionEnd = ctx.selectionEnd;
    this._context.textBeforeCursor = ctx.textBeforeCursor;
    this._context.textAfterCursor = ctx.textAfterCursor;

    if (selectionDirty) {
      this._fireEvent("selectionchange", {
        selectionStart: ctx.selectionStart,
        selectionEnd: ctx.selectionEnd,
        ownAction: ownAction
      });
    }

    if (surroundDirty) {
      this._fireEvent("surroundingtextchange", {
        beforeString: ctx.textBeforeCursor,
        afterString: ctx.textAfterCursor,
        ownAction: ownAction
      });
    }
  },

  _fireEvent: function ic_fireEvent(eventName, aDetail) {
    let detail = {
      detail: aDetail
    };

    let event = new this._window.CustomEvent(eventName,
                                             Cu.cloneInto(detail, this._window));
    this.__DOM_IMPL__.dispatchEvent(event);
  },

  // tag name of the input field
  get type() {
    return this._context.type;
  },

  // type of the input field
  get inputType() {
    return this._context.inputType;
  },

  get inputMode() {
    return this._context.inputMode;
  },

  get lang() {
    return this._context.lang;
  },

  getText: function ic_getText(offset, length) {
    let self = this;
    return this._sendPromise(function(resolverId) {
      cpmmSendAsyncMessageWithKbID(self, 'Keyboard:GetText', {
        contextId: self._contextId,
        requestId: resolverId,
        offset: offset,
        length: length
      });
    });
  },

  get selectionStart() {
    return this._context.selectionStart;
  },

  get selectionEnd() {
    return this._context.selectionEnd;
  },

  get textBeforeCursor() {
    return this._context.textBeforeCursor;
  },

  get textAfterCursor() {
    return this._context.textAfterCursor;
  },

  setSelectionRange: function ic_setSelectionRange(start, length) {
    let self = this;
    return this._sendPromise(function(resolverId) {
      cpmmSendAsyncMessageWithKbID(self, 'Keyboard:SetSelectionRange', {
        contextId: self._contextId,
        requestId: resolverId,
        selectionStart: start,
        selectionEnd: start + length
      });
    });
  },

  get onsurroundingtextchange() {
    return this.__DOM_IMPL__.getEventHandler("onsurroundingtextchange");
  },

  set onsurroundingtextchange(handler) {
    this.__DOM_IMPL__.setEventHandler("onsurroundingtextchange", handler);
  },

  get onselectionchange() {
    return this.__DOM_IMPL__.getEventHandler("onselectionchange");
  },

  set onselectionchange(handler) {
    this.__DOM_IMPL__.setEventHandler("onselectionchange", handler);
  },

  replaceSurroundingText: function ic_replaceSurrText(text, offset, length) {
    let self = this;
    return this._sendPromise(function(resolverId) {
      cpmmSendAsyncMessageWithKbID(self, 'Keyboard:ReplaceSurroundingText', {
        contextId: self._contextId,
        requestId: resolverId,
        text: text,
        offset: offset || 0,
        length: length || 0
      });
    });
  },

  deleteSurroundingText: function ic_deleteSurrText(offset, length) {
    return this.replaceSurroundingText(null, offset, length);
  },

  sendKey: function ic_sendKey(dictOrKeyCode, charCode, modifiers, repeat) {
    if (typeof dictOrKeyCode === 'number') {
      // XXX: modifiers are ignored in this API method.

      return this._sendPromise((resolverId) => {
        cpmmSendAsyncMessageWithKbID(this, 'Keyboard:SendKey', {
          contextId: this._contextId,
          requestId: resolverId,
          method: 'sendKey',
          keyCode: dictOrKeyCode,
          charCode: charCode,
          repeat: repeat
        });
      });
    } else if (typeof dictOrKeyCode === 'object') {
      return this._sendPromise((resolverId) => {
        cpmmSendAsyncMessageWithKbID(this, 'Keyboard:SendKey', {
          contextId: this._contextId,
          requestId: resolverId,
          method: 'sendKey',
          keyboardEventDict: this._getkeyboardEventDict(dictOrKeyCode)
        });
      });
    } else {
      // XXX: Should not reach here; implies WebIDL binding error.
      throw new TypeError('Unknown argument passed.');
    }
  },

  keydown: function ic_keydown(dict) {
    return this._sendPromise((resolverId) => {
      cpmmSendAsyncMessageWithKbID(this, 'Keyboard:SendKey', {
        contextId: this._contextId,
         requestId: resolverId,
        method: 'keydown',
        keyboardEventDict: this._getkeyboardEventDict(dict)
       });
     });
   },

  keyup: function ic_keyup(dict) {
    return this._sendPromise((resolverId) => {
      cpmmSendAsyncMessageWithKbID(this, 'Keyboard:SendKey', {
        contextId: this._contextId,
        requestId: resolverId,
        method: 'keyup',
        keyboardEventDict: this._getkeyboardEventDict(dict)
      });
    });
  },

  setComposition: function ic_setComposition(text, cursor, clauses, dict) {
    let self = this;
    return this._sendPromise((resolverId) => {
      cpmmSendAsyncMessageWithKbID(self, 'Keyboard:SetComposition', {
        contextId: self._contextId,
        requestId: resolverId,
        text: text,
        cursor: (typeof cursor !== 'undefined') ? cursor : text.length,
        clauses: clauses || null,
        keyboardEventDict: this._getkeyboardEventDict(dict)
      });
    });
  },

  endComposition: function ic_endComposition(text, dict) {
    let self = this;
    return this._sendPromise((resolverId) => {
      cpmmSendAsyncMessageWithKbID(self, 'Keyboard:EndComposition', {
        contextId: self._contextId,
        requestId: resolverId,
        text: text || '',
        keyboardEventDict: this._getkeyboardEventDict(dict)
      });
    });
  },

  _sendPromise: function(callback) {
    let self = this;
    return this._ipcHelper.createPromiseWithId(function(aResolverId) {
      if (!WindowMap.isActive(self._window)) {
        self._ipcHelper.removePromiseResolver(aResolverId);
        reject('Input method is not active.');
        return;
      }
      callback(aResolverId);
    });
  },

  // Take a MozInputMethodKeyboardEventDict dict, creates a keyboardEventDict
  // object that can be sent to forms.js
  _getkeyboardEventDict: function(dict) {
    if (typeof dict !== 'object' || !dict.key) {
      return;
    }

    var keyboardEventDict = {
      key: dict.key,
      code: dict.code,
      repeat: dict.repeat,
      flags: 0
    };

    if (dict.printable) {
      keyboardEventDict.flags |=
        Ci.nsITextInputProcessor.KEY_FORCE_PRINTABLE_KEY;
    }

    if (/^[a-zA-Z0-9]$/.test(dict.key)) {
      // keyCode must follow the key value in this range;
      // disregard the keyCode from content.
      keyboardEventDict.keyCode = dict.key.toUpperCase().charCodeAt(0);
    } else if (typeof dict.keyCode === 'number') {
      // Allow keyCode to be specified for other key values.
      keyboardEventDict.keyCode = dict.keyCode;

      // Allow keyCode to be explicitly set to zero.
      if (dict.keyCode === 0) {
        keyboardEventDict.flags |=
          Ci.nsITextInputProcessor.KEY_KEEP_KEYCODE_ZERO;
      }
    }

    return keyboardEventDict;
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([MozInputMethod]);
