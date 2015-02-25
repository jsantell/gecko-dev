/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if copying a request's url works.
 */

spawnTest(function*() {
  initNetMonitor(CUSTOM_GET_URL).then(([aTab, aDebuggee, aMonitor]) => {
    info("Starting test... ");

    let { NetMonitorView } = aMonitor.panelWin;
    let { RequestsMenu, ContextMenu } = NetMonitorView;

    waitForNetworkEvents(aMonitor, 1).then(() => {
      RequestsMenu.selectRequestByIndex(0);
      let model = RequestsMenu.getSelected(); 
      waitForClipboard(model.url, function setup() {
        ContextMenu._onCopyURL();
      }, function onSuccess() {
        ok(true, "Clipboard contains the currently selected item's url.");
        cleanUp();
      }, function onFailure() {
        ok(false, "Copying the currently selected item's url was unsuccessful.");
        cleanUp();
      });
    });

    aDebuggee.performRequests(1);

    function cleanUp(){
      teardown(aMonitor).then(finish);
    }
  });
});
