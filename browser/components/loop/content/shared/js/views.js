/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var loop = loop || {};
loop.shared = loop.shared || {};
loop.shared.views = (function(_, mozL10n) {
  "use strict";

  var sharedActions = loop.shared.actions;
  var sharedModels = loop.shared.models;
  var sharedMixins = loop.shared.mixins;
  var SCREEN_SHARE_STATES = loop.shared.utils.SCREEN_SHARE_STATES;

  /**
   * Media control button.
   *
   * Required props:
   * - {String}   scope   Media scope, can be "local" or "remote".
   * - {String}   type    Media type, can be "audio" or "video".
   * - {Function} action  Function to be executed on click.
   * - {Enabled}  enabled Stream activation status (default: true).
   */
  var MediaControlButton = React.createClass({displayName: "MediaControlButton",
    propTypes: {
      action: React.PropTypes.func.isRequired,
      enabled: React.PropTypes.bool.isRequired,
      scope: React.PropTypes.string.isRequired,
      title: React.PropTypes.string,
      type: React.PropTypes.string.isRequired,
      visible: React.PropTypes.bool.isRequired
    },

    getDefaultProps: function() {
      return {enabled: true, visible: true};
    },

    handleClick: function() {
      this.props.action();
    },

    _getClasses: function() {
      var cx = React.addons.classSet;
      // classes
      var classesObj = {
        "btn": true,
        "media-control": true,
        "transparent-button": true,
        "local-media": this.props.scope === "local",
        "muted": !this.props.enabled,
        "hide": !this.props.visible
      };
      classesObj["btn-mute-" + this.props.type] = true;
      return cx(classesObj);
    },

    _getTitle: function(enabled) {
      if (this.props.title) {
        return this.props.title;
      }

      var prefix = this.props.enabled ? "mute" : "unmute";
      var suffix = (this.props.type === "video") ? "button_title2" : "button_title";
      var msgId = [prefix, this.props.scope, this.props.type, suffix].join("_");
      return mozL10n.get(msgId);
    },

    render: function() {
      return (
        React.createElement("button", {className: this._getClasses(), 
                onClick: this.handleClick, 
                title: this._getTitle()})
      );
    }
  });

  /**
   * Screen sharing control button.
   *
   * Required props:
   * - {loop.Dispatcher} dispatcher  The dispatcher instance
   * - {Boolean}         visible     Set to true to display the button
   * - {String}          state       One of the screen sharing states, see
   *                                 loop.shared.utils.SCREEN_SHARE_STATES
   */
  var ScreenShareControlButton = React.createClass({displayName: "ScreenShareControlButton",
    mixins: [sharedMixins.DropdownMenuMixin()],

    propTypes: {
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      state: React.PropTypes.string.isRequired,
      visible: React.PropTypes.bool.isRequired
    },

    getInitialState: function() {
      var os = loop.shared.utils.getOS();
      var osVersion = loop.shared.utils.getOSVersion();
      // Disable screensharing on older OSX and Windows versions.
      if ((os.indexOf("mac") > -1 && osVersion.major <= 10 && osVersion.minor <= 6) ||
          (os.indexOf("win") > -1 && osVersion.major <= 5 && osVersion.minor <= 2)) {
        return { windowSharingDisabled: true };
      }
      return { windowSharingDisabled: false };
    },

    handleClick: function() {
      if (this.props.state === SCREEN_SHARE_STATES.ACTIVE) {
        this.props.dispatcher.dispatch(
          new sharedActions.EndScreenShare({}));
      } else {
        this.toggleDropdownMenu();
      }
    },

    _startScreenShare: function(type) {
      this.props.dispatcher.dispatch(new sharedActions.StartScreenShare({
        type: type
      }));
    },

    _handleShareTabs: function() {
      this._startScreenShare("browser");
    },

    _handleShareWindows: function() {
      this._startScreenShare("window");
    },

    _getTitle: function() {
      var prefix = this.props.state === SCREEN_SHARE_STATES.ACTIVE ?
        "active" : "inactive";

      return mozL10n.get(prefix + "_screenshare_button_title");
    },

    render: function() {
      if (!this.props.visible) {
        return null;
      }

      var cx = React.addons.classSet;

      var isActive = this.props.state === SCREEN_SHARE_STATES.ACTIVE;
      var screenShareClasses = cx({
        "btn": true,
        "btn-screen-share": true,
        "transparent-button": true,
        "menu-showing": this.state.showMenu,
        "active": isActive,
        "disabled": this.props.state === SCREEN_SHARE_STATES.PENDING
      });
      var dropdownMenuClasses = cx({
        "native-dropdown-menu": true,
        "conversation-window-dropdown": true,
        "hide": !this.state.showMenu,
        "visually-hidden": true
      });
      var windowSharingClasses = cx({
        "disabled": this.state.windowSharingDisabled
      });

      return (
        React.createElement("div", null, 
          React.createElement("button", {className: screenShareClasses, 
                  onClick: this.handleClick, 
                  ref: "menu-button", 
                  title: this._getTitle()}, 
            isActive ? null : React.createElement("span", {className: "chevron"})
          ), 
          React.createElement("ul", {className: dropdownMenuClasses, ref: "menu"}, 
            React.createElement("li", {onClick: this._handleShareTabs}, 
              mozL10n.get("share_tabs_button_title2")
            ), 
            React.createElement("li", {className: windowSharingClasses, onClick: this._handleShareWindows}, 
              mozL10n.get("share_windows_button_title")
            )
          )
        )
      );
    }
  });

  /**
   * Settings control button.
   */
  var SettingsControlButton = React.createClass({displayName: "SettingsControlButton",
    propTypes: {
      // Set to true if the menu should be below the button rather than above.
      menuBelow: React.PropTypes.bool,
      menuItems: React.PropTypes.array,
      mozLoop: React.PropTypes.object
    },

    mixins: [
      sharedMixins.DropdownMenuMixin(),
      React.addons.PureRenderMixin
    ],

    getDefaultProps: function() {
      return {
        menuBelow: false
      };
    },

    /**
     * Show or hide the settings menu
     */
    handleClick: function(event) {
      event.preventDefault();
      this.toggleDropdownMenu();
    },

    /**
     * Return the function that Show or hide the edit context edition form
     */
    getHandleToggleEdit: function(editItem) {
      return function _handleToglleEdit(event) {
          event.preventDefault();
          if (editItem.onClick) {
            editItem.onClick(!editItem.enabled);
          }
        };
    },

    /**
     * Load on the browser the help (support) url from prefs
     */
    handleHelpEntry: function(event) {
      event.preventDefault();
      var helloSupportUrl = this.props.mozLoop.getLoopPref("support_url");
      this.props.mozLoop.openURL(helloSupportUrl);
    },

    /**
     * Load on the browser the feedback url from prefs
     */
    handleSubmitFeedback: function(event) {
      event.preventDefault();
      var helloFeedbackUrl = this.props.mozLoop.getLoopPref("feedback.formURL");
      this.props.mozLoop.openURL(helloFeedbackUrl);
    },

    /**
     * Recover the needed info for generating an specific menu Item
     */
    getItemInfo: function(menuItem) {
      var cx = React.addons.classSet;
      switch (menuItem.id) {
        case "feedback":
          return {
            cssClasses: "dropdown-menu-item",
            handler: this.handleSubmitFeedback,
            label: mozL10n.get("feedback_request_button")
          };
        case "help":
          return {
            cssClasses: "dropdown-menu-item",
            handler: this.handleHelpEntry,
            label: mozL10n.get("help_label")
          };
        case "edit":
          return {
            cssClasses: cx({
              "dropdown-menu-item": true,
              "entry-settings-edit": true,
              "hide": !menuItem.visible
            }),
            handler: this.getHandleToggleEdit(menuItem),
            label: mozL10n.get(menuItem.enabled ?
              "conversation_settings_menu_edit_context" :
              "conversation_settings_menu_hide_context"),
            scope: "local",
            type: "edit"
          };
        default:
          console.error("Invalid menu item", menuItem);
          return null;
       }
    },

    /**
     * Generate a menu item after recover its info
     */
    generateMenuItem: function(menuItem) {
      var itemInfo = this.getItemInfo(menuItem);
      if (!itemInfo) {
        return null;
      }
      return (
        React.createElement("li", {className: itemInfo.cssClasses, 
            key: menuItem.id, 
            onClick: itemInfo.handler, 
            scope: itemInfo.scope || "", 
            type: itemInfo.type || ""}, 
          itemInfo.label
        )
        );
    },

    render: function() {
      if (!this.props.menuItems || !this.props.menuItems.length) {
        return null;
      }
      var menuItemRows = this.props.menuItems.map(this.generateMenuItem)
        .filter(function(item) { return item; });

      if (!menuItemRows || !menuItemRows.length) {
        return null;
      }

      var cx = React.addons.classSet;
      var settingsDropdownMenuClasses = cx({
        "settings-menu": true,
        "dropdown-menu": true,
        "menu-below": this.props.menuBelow,
        "hide": !this.state.showMenu
      });
      return (
        React.createElement("div", {className: "settings-control"}, 
          React.createElement("button", {className: "btn btn-settings transparent-button", 
             onClick: this.toggleDropdownMenu, 
             ref: "anchor", 
             title: mozL10n.get("settings_menu_button_tooltip")}), 
          React.createElement("ul", {className: settingsDropdownMenuClasses, ref: "menu"}, 
            menuItemRows
          )
        )
      );
    }
  });

  /**
   * Conversation controls.
   */
  var ConversationToolbar = React.createClass({displayName: "ConversationToolbar",
    getDefaultProps: function() {
      return {
        video: {enabled: true, visible: true},
        audio: {enabled: true, visible: true},
        screenShare: {state: SCREEN_SHARE_STATES.INACTIVE, visible: false},
        settingsMenuItems: null,
        enableHangup: true
      };
    },

    getInitialState: function() {
      return {
        idle: false
      };
    },

    propTypes: {
      audio: React.PropTypes.object.isRequired,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      enableHangup: React.PropTypes.bool,
      hangup: React.PropTypes.func.isRequired,
      hangupButtonLabel: React.PropTypes.string,
      mozLoop: React.PropTypes.object,
      publishStream: React.PropTypes.func.isRequired,
      screenShare: React.PropTypes.object,
      settingsMenuItems: React.PropTypes.array,
      video: React.PropTypes.object.isRequired
    },

    handleClickHangup: function() {
      this.props.hangup();
    },

    handleToggleVideo: function() {
      this.props.publishStream("video", !this.props.video.enabled);
    },

    handleToggleAudio: function() {
      this.props.publishStream("audio", !this.props.audio.enabled);
    },

    componentDidMount: function() {
      this.userActivity = false;
      this.startIdleCountDown();
      document.body.addEventListener("mousemove", this._onBodyMouseMove);
    },

    componentWillUnmount: function() {
      clearTimeout(this.inactivityTimeout);
      clearInterval(this.inactivityPollInterval);
      document.body.removeEventListener("mousemove", this._onBodyMouseMove);
    },

    /**
     * If the conversation toolbar is idle, update its state and initialize the countdown
     * to return of the idle state. If the toolbar is active, only it's updated the userActivity flag.
     */
    _onBodyMouseMove: function() {
      if (this.state.idle) {
        this.setState({idle: false});
        this.startIdleCountDown();
      } else {
        this.userActivity = true;
      }
    },

    /**
     * Instead of resetting the timeout for every mousemove (this event is called to many times,
     * when the mouse is moving, we check the flat userActivity every 4 seconds. If the flag is activated,
     * the user is still active, and we can restart the countdown for the idle state
     */
    checkUserActivity: function() {
      this.inactivityPollInterval = setInterval(function() {
        if (this.userActivity) {
          this.userActivity = false;
          this.restartIdleCountDown();
        }
      }.bind(this), 4000);
    },

    /**
     * Stop the execution of the current inactivity countdown and it starts a new one.
     */
    restartIdleCountDown: function() {
      clearTimeout(this.inactivityTimeout);
      this.startIdleCountDown();
    },

    /**
     * Launchs the process to check the user activity and the inactivity countdown to change
     * the toolbar to idle.
     * When the toolbar changes to idle, we remove the procces to check the user activity,
     * because the toolbar is going to be updated directly when the user moves the mouse.
     */
    startIdleCountDown: function() {
      this.checkUserActivity();
      this.inactivityTimeout = setTimeout(function() {
        this.setState({idle: true});
        clearInterval(this.inactivityPollInterval);
      }.bind(this), 6000);
    },

    _getHangupButtonLabel: function() {
      return this.props.hangupButtonLabel || mozL10n.get("hangup_button_caption2");
    },

    render: function() {
      var cx = React.addons.classSet;
      var conversationToolbarCssClasses = cx({
        "conversation-toolbar": true,
        "idle": this.state.idle
      });
      var mediaButtonGroupCssClasses = cx({
        "conversation-toolbar-media-btn-group-box": true,
        "hide": (!this.props.video.visible && !this.props.audio.visible)
      });
      return (
        React.createElement("ul", {className: conversationToolbarCssClasses}, 
          React.createElement("li", {className: "conversation-toolbar-btn-box btn-hangup-entry"}, 
            React.createElement("button", {className: "btn btn-hangup", 
                    disabled: !this.props.enableHangup, 
                    onClick: this.handleClickHangup, 
                    title: mozL10n.get("hangup_button_title")}, 
              this._getHangupButtonLabel()
            )
          ), 
          React.createElement("li", {className: "conversation-toolbar-btn-box"}, 
            React.createElement("div", {className: mediaButtonGroupCssClasses}, 
                React.createElement(MediaControlButton, {action: this.handleToggleVideo, 
                                    enabled: this.props.video.enabled, 
                                    scope: "local", type: "video", 
                                    visible: this.props.video.visible}), 
                React.createElement(MediaControlButton, {action: this.handleToggleAudio, 
                                    enabled: this.props.audio.enabled, 
                                    scope: "local", type: "audio", 
                                    visible: this.props.audio.visible})
            )
          ), 
          React.createElement("li", {className: "conversation-toolbar-btn-box"}, 
            React.createElement(ScreenShareControlButton, {dispatcher: this.props.dispatcher, 
                                      state: this.props.screenShare.state, 
                                      visible: this.props.screenShare.visible})
          ), 
          React.createElement("li", {className: "conversation-toolbar-btn-box btn-edit-entry"}, 
            React.createElement(SettingsControlButton, {menuItems: this.props.settingsMenuItems, 
                                   mozLoop: this.props.mozLoop})
          )
        )
      );
    }
  });

  /**
   * Conversation view.
   */
  var ConversationView = React.createClass({displayName: "ConversationView",
    mixins: [
      Backbone.Events,
      sharedMixins.AudioMixin,
      sharedMixins.MediaSetupMixin
    ],

    propTypes: {
      audio: React.PropTypes.object,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      initiate: React.PropTypes.bool,
      isDesktop: React.PropTypes.bool,
      model: React.PropTypes.object.isRequired,
      mozLoop: React.PropTypes.object,
      sdk: React.PropTypes.object.isRequired,
      video: React.PropTypes.object
    },

    getDefaultProps: function() {
      return {
        initiate: true,
        isDesktop: false,
        video: {enabled: true, visible: true},
        audio: {enabled: true, visible: true}
      };
    },

    getInitialState: function() {
      return {
        video: this.props.video,
        audio: this.props.audio
      };
    },

    componentDidMount: function() {
      if (this.props.initiate) {
        /**
         * XXX This is a workaround for desktop machines that do not have a
         * camera installed. As we don't yet have device enumeration, when
         * we do, this can be removed (bug 1138851), and the sdk should handle it.
         */
        if (this.props.isDesktop &&
            !window.MediaStreamTrack.getSources) {
          // If there's no getSources function, the sdk defines its own and caches
          // the result. So here we define the "normal" one which doesn't get cached, so
          // we can change it later.
          window.MediaStreamTrack.getSources = function(callback) {
            callback([{kind: "audio"}, {kind: "video"}]);
          };
        }

        this.listenTo(this.props.sdk, "exception", this._handleSdkException);

        this.listenTo(this.props.model, "session:connected",
                                        this._onSessionConnected);
        this.listenTo(this.props.model, "session:stream-created",
                                        this._streamCreated);
        this.listenTo(this.props.model, ["session:peer-hungup",
                                         "session:network-disconnected",
                                         "session:ended"].join(" "),
                                         this.stopPublishing);
        this.props.model.startSession();
      }
    },

    componentWillUnmount: function() {
      // Unregister all local event listeners
      this.stopListening();
      this.hangup();
    },

    hangup: function() {
      this.stopPublishing();
      this.props.model.endSession();
    },

    _onSessionConnected: function(event) {
      this.startPublishing(event);
      this.play("connected");
    },

    /**
     * Subscribes and attaches each created stream to a DOM element.
     *
     * XXX: for now we only support a single remote stream, hence a single DOM
     *      element.
     *
     * http://tokbox.com/opentok/libraries/client/js/reference/StreamEvent.html
     *
     * @param  {StreamEvent} event
     */
    _streamCreated: function(event) {
      var incoming = this.getDOMNode().querySelector(".remote");
      this.props.model.subscribe(event.stream, incoming,
        this.getDefaultPublisherConfig({
          publishVideo: this.props.video.enabled
        }));
    },

    /**
     * Handles the SDK Exception event.
     *
     * https://tokbox.com/opentok/libraries/client/js/reference/ExceptionEvent.html
     *
     * @param {ExceptionEvent} event
     */
    _handleSdkException: function(event) {
      /**
       * XXX This is a workaround for desktop machines that do not have a
       * camera installed. As we don't yet have device enumeration, when
       * we do, this can be removed (bug 1138851), and the sdk should handle it.
       */
      if (this.publisher &&
          event.code === OT.ExceptionCodes.UNABLE_TO_PUBLISH &&
          event.message === "GetUserMedia" &&
          this.state.video.enabled) {
        this.state.video.enabled = false;

        window.MediaStreamTrack.getSources = function(callback) {
          callback([{kind: "audio"}]);
        };

        this.stopListening(this.publisher);
        this.publisher.destroy();
        this.startPublishing();
      }
    },

    /**
     * Publishes remote streams available once a session is connected.
     *
     * http://tokbox.com/opentok/libraries/client/js/reference/SessionConnectEvent.html
     *
     * @param  {SessionConnectEvent} event
     */
    startPublishing: function(event) {
      var outgoing = this.getDOMNode().querySelector(".local");

      // XXX move this into its StreamingVideo component?
      this.publisher = this.props.sdk.initPublisher(
        outgoing, this.getDefaultPublisherConfig({publishVideo: this.props.video.enabled}));

      // Suppress OT GuM custom dialog, see bug 1018875
      this.listenTo(this.publisher, "accessDialogOpened accessDenied",
                    function(ev) {
                      ev.preventDefault();
                    });

      this.listenTo(this.publisher, "streamCreated", function(ev) {
        this.setState({
          audio: {enabled: ev.stream.hasAudio},
          video: {enabled: ev.stream.hasVideo}
        });
      });

      this.listenTo(this.publisher, "streamDestroyed", function() {
        this.setState({
          audio: {enabled: false},
          video: {enabled: false}
        });
      });

      this.props.model.publish(this.publisher);
    },

    /**
     * Toggles streaming status for a given stream type.
     *
     * @param  {String}  type     Stream type ("audio" or "video").
     * @param  {Boolean} enabled  Enabled stream flag.
     */
    publishStream: function(type, enabled) {
      if (type === "audio") {
        this.publisher.publishAudio(enabled);
        this.setState({audio: {enabled: enabled}});
      } else {
        this.publisher.publishVideo(enabled);
        this.setState({video: {enabled: enabled}});
      }
    },

    /**
     * Unpublishes local stream.
     */
    stopPublishing: function() {
      if (this.publisher) {
        // Unregister listeners for publisher events
        this.stopListening(this.publisher);

        this.props.model.session.unpublish(this.publisher);
      }
    },

    render: function() {
      var localStreamClasses = React.addons.classSet({
        local: true,
        "local-stream": true,
        "local-stream-audio": !this.state.video.enabled
      });
      return (
        React.createElement("div", {className: "video-layout-wrapper"}, 
          React.createElement("div", {className: "conversation in-call"}, 
            React.createElement("div", {className: "media nested"}, 
              React.createElement("div", {className: "video_wrapper remote_wrapper"}, 
                React.createElement("div", {className: "video_inner remote focus-stream"}, 
                  React.createElement(ConversationToolbar, {
                    audio: this.state.audio, 
                    dispatcher: this.props.dispatcher, 
                    hangup: this.hangup, 
                    mozLoop: this.props.mozLoop, 
                    publishStream: this.publishStream, 
                    video: this.state.video})
                )
              ), 
              React.createElement("div", {className: localStreamClasses})

            )
          )
        )
      );
    }
  });

  /**
   * Notification view.
   */
  var NotificationView = React.createClass({displayName: "NotificationView",
    mixins: [Backbone.Events],

    propTypes: {
      notification: React.PropTypes.object.isRequired
    },

    render: function() {
      var notification = this.props.notification;
      return (
        React.createElement("div", {className: "notificationContainer"}, 
          React.createElement("div", {className: "alert alert-" + notification.get("level")}, 
            React.createElement("span", {className: "message"}, notification.get("message"))
          ), 
          React.createElement("div", {className: "detailsBar details-" + notification.get("level"), 
               hidden: !notification.get("details")}, 
            React.createElement("button", {className: "detailsButton btn-info", 
                    hidden: !notification.get("detailsButtonLabel") || !notification.get("detailsButtonCallback"), 
                    onClick: notification.get("detailsButtonCallback")}, 
              notification.get("detailsButtonLabel")
            ), 
            React.createElement("span", {className: "details"}, notification.get("details"))
          )
        )
      );
    }
  });

  /**
   * Notification list view.
   */
  var NotificationListView = React.createClass({displayName: "NotificationListView",
    mixins: [Backbone.Events, sharedMixins.DocumentVisibilityMixin],

    propTypes: {
      clearOnDocumentHidden: React.PropTypes.bool,
      notifications: React.PropTypes.object.isRequired
    },

    getDefaultProps: function() {
      return {clearOnDocumentHidden: false};
    },

    componentDidMount: function() {
      this.listenTo(this.props.notifications, "reset add remove", function() {
        this.forceUpdate();
      });
    },

    componentWillUnmount: function() {
      this.stopListening(this.props.notifications);
    },

    /**
     * Provided by DocumentVisibilityMixin. Clears notifications stack when the
     * current document is hidden if the clearOnDocumentHidden prop is set to
     * true and the collection isn't empty.
     */
    onDocumentHidden: function() {
      if (this.props.clearOnDocumentHidden &&
          this.props.notifications.length > 0) {
        // Note: The `silent` option prevents the `reset` event to be triggered
        // here, preventing the UI to "jump" a little because of the event
        // callback being processed in another tick (I think).
        this.props.notifications.reset([], {silent: true});
        this.forceUpdate();
      }
    },

    render: function() {
      return (
        React.createElement("div", {className: "messages"}, 
          this.props.notifications.map(function(notification, key) {
            return React.createElement(NotificationView, {key: key, notification: notification});
          })
        )
      );
    }
  });

  var Button = React.createClass({displayName: "Button",
    propTypes: {
      additionalClass: React.PropTypes.string,
      caption: React.PropTypes.string.isRequired,
      children: React.PropTypes.element,
      disabled: React.PropTypes.bool,
      htmlId: React.PropTypes.string,
      onClick: React.PropTypes.func.isRequired
    },

    getDefaultProps: function() {
      return {
        disabled: false,
        additionalClass: "",
        htmlId: ""
      };
    },

    render: function() {
      var cx = React.addons.classSet;
      var classObject = { button: true, disabled: this.props.disabled };
      if (this.props.additionalClass) {
        classObject[this.props.additionalClass] = true;
      }
      return (
        React.createElement("button", {className: cx(classObject), 
                disabled: this.props.disabled, 
                id: this.props.htmlId, 
                onClick: this.props.onClick}, 
          React.createElement("span", {className: "button-caption"}, this.props.caption), 
          this.props.children
        )
      );
    }
  });

  var ButtonGroup = React.createClass({displayName: "ButtonGroup",
    propTypes: {
      additionalClass: React.PropTypes.string,
      children: React.PropTypes.oneOfType([
        React.PropTypes.element,
        React.PropTypes.arrayOf(React.PropTypes.element)
      ])
    },

    getDefaultProps: function() {
      return {
        additionalClass: ""
      };
    },

    render: function() {
      var cx = React.addons.classSet;
      var classObject = { "button-group": true };
      if (this.props.additionalClass) {
        classObject[this.props.additionalClass] = true;
      }
      return (
        React.createElement("div", {className: cx(classObject)}, 
          this.props.children
        )
      );
    }
  });

  var Checkbox = React.createClass({displayName: "Checkbox",
    propTypes: {
      additionalClass: React.PropTypes.string,
      checked: React.PropTypes.bool,
      disabled: React.PropTypes.bool,
      label: React.PropTypes.string,
      onChange: React.PropTypes.func.isRequired,
      // If true, this will cause the label to be cut off at the end of the
      // first line with an ellipsis, and a tooltip supplied.
      useEllipsis: React.PropTypes.bool,
      // If `value` is not supplied, the consumer should rely on the boolean
      // `checked` state changes.
      value: React.PropTypes.string
    },

    getDefaultProps: function() {
      return {
        additionalClass: "",
        checked: false,
        disabled: false,
        label: null,
        useEllipsis: false,
        value: ""
      };
    },

    componentWillReceiveProps: function(nextProps) {
      // Only change the state if the prop has changed, and if it is also
      // different from the state.
      if (this.props.checked !== nextProps.checked &&
          this.state.checked !== nextProps.checked) {
        this.setState({ checked: nextProps.checked });
      }
    },

    getInitialState: function() {
      return {
        checked: this.props.checked,
        value: this.props.checked ? this.props.value : ""
      };
    },

    _handleClick: function(event) {
      event.preventDefault();

      var newState = {
        checked: !this.state.checked,
        value: this.state.checked ? "" : this.props.value
      };
      this.setState(newState);
      this.props.onChange(newState);
    },

    render: function() {
      var cx = React.addons.classSet;
      var wrapperClasses = {
        "checkbox-wrapper": true,
        disabled: this.props.disabled
      };
      var checkClasses = {
        checkbox: true,
        checked: this.state.checked,
        disabled: this.props.disabled
      };
      var labelClasses = {
        "checkbox-label": true,
        "ellipsis": this.props.useEllipsis
      };

      if (this.props.additionalClass) {
        wrapperClasses[this.props.additionalClass] = true;
      }
      return (
        React.createElement("div", {className: cx(wrapperClasses), 
             disabled: this.props.disabled, 
             onClick: this._handleClick}, 
          React.createElement("div", {className: cx(checkClasses)}), 
          
            this.props.label ?
              React.createElement("div", {className: cx(labelClasses), 
                   title: this.props.useEllipsis ? this.props.label : ""}, 
                this.props.label
              ) : null
          
        )
      );
    }
  });

  /**
   * Renders an avatar element for display when video is muted.
   */
  var AvatarView = React.createClass({displayName: "AvatarView",
    mixins: [React.addons.PureRenderMixin],

    render: function() {
        return React.createElement("div", {className: "avatar"});
    }
  });

  /**
   * Renders a loading spinner for when video content is not yet available.
   */
  var LoadingView = React.createClass({displayName: "LoadingView",
    mixins: [React.addons.PureRenderMixin],

    render: function() {
        return (
          React.createElement("div", {className: "loading-background"}, 
            React.createElement("div", {className: "loading-stream"})
          )
        );
    }
  });

  /**
   * Renders a url that's part of context on the display.
   *
   * @property {Boolean} allowClick         Set to true to allow the url to be clicked. If this
   *                                        is specified, then 'dispatcher' is also required.
   * @property {String}  description        The description for the context url.
   * @property {loop.Dispatcher} dispatcher
   * @property {Boolean} showContextTitle   Whether or not to show the "Let's talk about" title.
   * @property {String}  thumbnail          The thumbnail url (expected to be a data url) to
   *                                        display. If not specified, a fallback url will be
   *                                        shown.
   * @property {String}  url                The url to be displayed. If not present or invalid,
   *                                        then this view won't be displayed.
   * @property {Boolean} useDesktopPaths    Whether or not to use the desktop paths for for the
   *                                        fallback url.
   */
  var ContextUrlView = React.createClass({displayName: "ContextUrlView",
    mixins: [React.addons.PureRenderMixin],

    propTypes: {
      allowClick: React.PropTypes.bool.isRequired,
      description: React.PropTypes.string.isRequired,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher),
      showContextTitle: React.PropTypes.bool.isRequired,
      thumbnail: React.PropTypes.string,
      url: React.PropTypes.string,
      useDesktopPaths: React.PropTypes.bool.isRequired
    },

    /**
     * Dispatches an action to record when the link is clicked.
     */
    handleLinkClick: function() {
      if (!this.props.allowClick) {
        return;
      }

      this.props.dispatcher.dispatch(new sharedActions.RecordClick({
        linkInfo: "Shared URL"
      }));
    },

    /**
     * Renders the context title ("Let's talk about") if necessary.
     */
    renderContextTitle: function() {
      if (!this.props.showContextTitle) {
        return null;
      }

      return React.createElement("p", null, mozL10n.get("context_inroom_label"));
    },

    render: function() {
      var hostname;

      try {
        hostname = new URL(this.props.url).hostname;
      } catch (ex) {
        return null;
      }

      var thumbnail = this.props.thumbnail;

      if (!thumbnail) {
        thumbnail = this.props.useDesktopPaths ?
          "loop/shared/img/icons-16x16.svg#globe" :
          "shared/img/icons-16x16.svg#globe";
      }

      var wrapperClasses = React.addons.classSet({
        "context-wrapper": true,
        "clicks-allowed": this.props.allowClick
      });

      return (
        React.createElement("div", {className: "context-content"}, 
          this.renderContextTitle(), 
          React.createElement("a", {className: wrapperClasses, 
             href: this.props.allowClick ? this.props.url : null, 
             onClick: this.handleLinkClick, 
             rel: "noreferrer", 
             target: "_blank"}, 
            React.createElement("img", {className: "context-preview", src: thumbnail}), 
            React.createElement("span", {className: "context-info"}, 
              this.props.description, 
              React.createElement("span", {className: "context-url"}, 
                hostname
              )
            )
          )
        )
      );
    }
  });

  /**
   * Renders a media element for display. This also handles displaying an avatar
   * instead of the video, and attaching a video stream to the video element.
   */
  var MediaView = React.createClass({displayName: "MediaView",
    // srcVideoObject should be ok for a shallow comparison, so we are safe
    // to use the pure render mixin here.
    mixins: [React.addons.PureRenderMixin],

    propTypes: {
      displayAvatar: React.PropTypes.bool.isRequired,
      isLoading: React.PropTypes.bool.isRequired,
      mediaType: React.PropTypes.string.isRequired,
      posterUrl: React.PropTypes.string,
      // Expecting "local" or "remote".
      srcVideoObject: React.PropTypes.object
    },

    componentDidMount: function() {
      if (!this.props.displayAvatar) {
        this.attachVideo(this.props.srcVideoObject);
      }
    },

    componentDidUpdate: function() {
      if (!this.props.displayAvatar) {
        this.attachVideo(this.props.srcVideoObject);
      }
    },

    /**
     * Attaches a video stream from a donor video element to this component's
     * video element if the component is displaying one.
     *
     * @param {Object} srcVideoObject The src video object to clone the stream
     *                                from.
     *
     * XXX need to have a corresponding detachVideo or change this to syncVideo
     * to protect from leaks (bug 1171978)
     */
    attachVideo: function(srcVideoObject) {
      if (!srcVideoObject) {
        // Not got anything to display.
        return;
      }

      var videoElement = this.getDOMNode();

      if (videoElement.tagName.toLowerCase() !== "video") {
        // Must be displaying the avatar view, so don't try and attach video.
        return;
      }

      // Set the src of our video element
      var attrName = "";
      if ("srcObject" in videoElement) {
        // srcObject is according to the standard.
        attrName = "srcObject";
      } else if ("mozSrcObject" in videoElement) {
        // mozSrcObject is for Firefox
        attrName = "mozSrcObject";
      } else if ("src" in videoElement) {
        // src is for Chrome.
        attrName = "src";
      } else {
        console.error("Error attaching stream to element - no supported" +
                      "attribute found");
        return;
      }

      // If the object hasn't changed it, then don't reattach it.
      if (videoElement[attrName] !== srcVideoObject[attrName]) {
        videoElement[attrName] = srcVideoObject[attrName];
      }
      videoElement.play();
    },

    render: function() {
      if (this.props.isLoading) {
        return React.createElement(LoadingView, null);
      }

      if (this.props.displayAvatar) {
        return React.createElement(AvatarView, null);
      }

      if (!this.props.srcVideoObject && !this.props.posterUrl) {
        return React.createElement("div", {className: "no-video"});
      }

      var optionalPoster = {};
      if (this.props.posterUrl) {
        optionalPoster.poster = this.props.posterUrl;
      }

      // For now, always mute media. For local media, we should be muted anyway,
      // as we don't want to hear ourselves speaking.
      //
      // For remote media, we would ideally have this live video element in
      // control of the audio, but due to the current method of not rendering
      // the element at all when video is muted we have to rely on the hidden
      // dom element in the sdk driver to play the audio.
      // We might want to consider changing this if we add UI controls relating
      // to the remote audio at some stage in the future.
      return (
        React.createElement("video", React.__spread({},  optionalPoster, 
               {className: this.props.mediaType + "-video", 
               muted: true}))
      );
    }
  });

  var MediaLayoutView = React.createClass({displayName: "MediaLayoutView",
    propTypes: {
      children: React.PropTypes.node,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      displayScreenShare: React.PropTypes.bool.isRequired,
      isLocalLoading: React.PropTypes.bool.isRequired,
      isRemoteLoading: React.PropTypes.bool.isRequired,
      isScreenShareLoading: React.PropTypes.bool.isRequired,
      // The poster URLs are for UI-showcase testing and development.
      localPosterUrl: React.PropTypes.string,
      localSrcVideoObject: React.PropTypes.object,
      localVideoMuted: React.PropTypes.bool.isRequired,
      // Passing in matchMedia, allows it to be overriden for ui-showcase's
      // benefit. We expect either the override or window.matchMedia.
      matchMedia: React.PropTypes.func.isRequired,
      remotePosterUrl: React.PropTypes.string,
      remoteSrcVideoObject: React.PropTypes.object,
      renderRemoteVideo: React.PropTypes.bool.isRequired,
      screenSharePosterUrl: React.PropTypes.string,
      screenShareVideoObject: React.PropTypes.object,
      showContextRoomName: React.PropTypes.bool.isRequired,
      useDesktopPaths: React.PropTypes.bool.isRequired
    },

    isLocalMediaAbsolutelyPositioned: function(matchMedia) {
      if (!matchMedia) {
        matchMedia = this.props.matchMedia;
      }
      return matchMedia &&
        // The screen width is less than 640px and we are not screen sharing.
        ((matchMedia("screen and (max-width:640px)").matches &&
         !this.props.displayScreenShare) ||
         // or the screen width is less than 300px.
         (matchMedia("screen and (max-width:300px)").matches));
    },

    getInitialState: function() {
      return {
        localMediaAboslutelyPositioned: this.isLocalMediaAbsolutelyPositioned()
      };
    },

    componentWillReceiveProps: function(nextProps) {
      // This is all for the ui-showcase's benefit.
      if (this.props.matchMedia !== nextProps.matchMedia) {
        this.updateLocalMediaState(null, nextProps.matchMedia);
      }
    },

    componentDidMount: function() {
      window.addEventListener("resize", this.updateLocalMediaState);
    },

    componentWillUnmount: function() {
      window.removeEventListener("resize", this.updateLocalMediaState);
    },

    updateLocalMediaState: function(event, matchMedia) {
      var newState = this.isLocalMediaAbsolutelyPositioned(matchMedia);
      if (this.state.localMediaAboslutelyPositioned !== newState) {
        this.setState({
          localMediaAboslutelyPositioned: newState
        });
      }
    },

    renderLocalVideo: function() {
      return (
        React.createElement("div", {className: "local"}, 
          React.createElement(MediaView, {displayAvatar: this.props.localVideoMuted, 
            isLoading: this.props.isLocalLoading, 
            mediaType: "local", 
            posterUrl: this.props.localPosterUrl, 
            srcVideoObject: this.props.localSrcVideoObject})
        )
      );
    },

    render: function() {
      var remoteStreamClasses = React.addons.classSet({
        "remote": true,
        "focus-stream": !this.props.displayScreenShare
      });

      var screenShareStreamClasses = React.addons.classSet({
        "screen": true,
        "focus-stream": this.props.displayScreenShare
      });

      var mediaWrapperClasses = React.addons.classSet({
        "media-wrapper": true,
        "receiving-screen-share": this.props.displayScreenShare,
        "showing-local-streams": this.props.localSrcVideoObject ||
          this.props.localPosterUrl,
        "showing-remote-streams": this.props.remoteSrcVideoObject ||
          this.props.remotePosterUrl || this.props.isRemoteLoading
      });

      return (
        React.createElement("div", {className: "media-layout"}, 
          React.createElement("div", {className: mediaWrapperClasses}, 
            React.createElement("span", {className: "self-view-hidden-message"}, 
              mozL10n.get("self_view_hidden_message")
            ), 
            React.createElement("div", {className: remoteStreamClasses}, 
              React.createElement(MediaView, {displayAvatar: !this.props.renderRemoteVideo, 
                isLoading: this.props.isRemoteLoading, 
                mediaType: "remote", 
                posterUrl: this.props.remotePosterUrl, 
                srcVideoObject: this.props.remoteSrcVideoObject}), 
               this.state.localMediaAboslutelyPositioned ?
                this.renderLocalVideo() : null, 
               this.props.children

            ), 
            React.createElement("div", {className: screenShareStreamClasses}, 
              React.createElement(MediaView, {displayAvatar: false, 
                isLoading: this.props.isScreenShareLoading, 
                mediaType: "screen-share", 
                posterUrl: this.props.screenSharePosterUrl, 
                srcVideoObject: this.props.screenShareVideoObject})
            ), 
            React.createElement(loop.shared.views.chat.TextChatView, {
              dispatcher: this.props.dispatcher, 
              showRoomName: this.props.showContextRoomName, 
              useDesktopPaths: this.props.useDesktopPaths}), 
             this.state.localMediaAboslutelyPositioned ?
              null : this.renderLocalVideo()
          )
        )
      );
    }
  });

  return {
    AvatarView: AvatarView,
    Button: Button,
    ButtonGroup: ButtonGroup,
    Checkbox: Checkbox,
    ContextUrlView: ContextUrlView,
    ConversationView: ConversationView,
    ConversationToolbar: ConversationToolbar,
    MediaControlButton: MediaControlButton,
    MediaLayoutView: MediaLayoutView,
    MediaView: MediaView,
    LoadingView: LoadingView,
    SettingsControlButton: SettingsControlButton,
    ScreenShareControlButton: ScreenShareControlButton,
    NotificationListView: NotificationListView
  };
})(_, navigator.mozL10n || document.mozL10n);
