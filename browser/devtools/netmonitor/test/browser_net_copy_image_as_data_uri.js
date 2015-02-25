/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if copying an image as data uri works.
 */

spawnTest(function*() {
  initNetMonitor(CONTENT_TYPE_WITHOUT_CACHE_URL).then(([aTab, aDebuggee, aMonitor]) => {
    info("Starting test... ");

    let { NetMonitorView } = aMonitor.panelWin;
    let { ContextMenu, RequestsMenu } = NetMonitorView;

    RequestsMenu.lazyUpdate = false;

    waitForNetworkEvents(aMonitor, 7).then(() => {
      RequestsMenu.selectedIndex = 5;

      waitForClipboard(TEST_IMAGE_DATA_URI, function setup() {
        ContextMenu._onCopyImage();
      }, function onSuccess() {
        ok(true, "Clipboard contains the currently selected image as data uri.");
        cleanUp();
      }, function onFailure() {
        ok(false, "Copying the currently selected image as data uri was unsuccessful.");
        cleanUp();
      });
    });

    aDebuggee.performRequests();

    function cleanUp(){
      teardown(aMonitor).then(finish);
    }
  });
});
