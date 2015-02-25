/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if focus modifiers work for the SideMenuWidget.
 */

function test() {
  initNetMonitor(CUSTOM_GET_URL).then(([aTab, aDebuggee, aMonitor]) => {
    info("Starting test... ");

    // It seems that this test may be slow on Ubuntu builds running on ec2.
    requestLongerTimeout(2);

    let { NetMonitorView } = aMonitor.panelWin;
    let { Sidebar, RequestsMenu: { tableRenderer: Table }} = NetMonitorView;

    Table.lazyUpdate = false;

    waitForNetworkEvents(aMonitor, 2).then(() => {
      check(-1, false);

      Table.focusLastVisibleItem();
      check(1, true);
      Table.focusFirstVisibleItem();
      check(0, true);

      Table.focusNextItem();
      check(1, true);
      Table.focusPrevItem();
      check(0, true);

      Table.focusItemAtDelta(+1);
      check(1, true);
      Table.focusItemAtDelta(-1);
      check(0, true);

      Table.focusItemAtDelta(+10);
      check(1, true);
      Table.focusItemAtDelta(-10);
      check(0, true);

      aDebuggee.performRequests(18);
      return waitForNetworkEvents(aMonitor, 18);
    })
    .then(() => {
      Table.focusLastVisibleItem();
      check(19, true);
      Table.focusFirstVisibleItem();
      check(0, true);

      Table.focusNextItem();
      check(1, true);
      Table.focusPrevItem();
      check(0, true);

      Table.focusItemAtDelta(+10);
      check(10, true);
      Table.focusItemAtDelta(-10);
      check(0, true);

      Table.focusItemAtDelta(+100);
      check(19, true);
      Table.focusItemAtDelta(-100);
      check(0, true);

      teardown(aMonitor).then(finish);
    });

    let count = 0;

    function check(aSelectedIndex, aPaneVisibility) {
      info("Performing check " + (count++) + ".");

      is(Table.selectedIndex, aSelectedIndex,
        "The selected item in the requests menu was incorrect.");
      is(Sidebar.detailsPaneHidden, !aPaneVisibility,
        "The network requests details pane visibility state was incorrect.");
    }

    aDebuggee.performRequests(2);
  });
}
