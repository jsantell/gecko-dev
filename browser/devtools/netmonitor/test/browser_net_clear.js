/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if the clear button empties the request menu.
 */

function test() {
  initNetMonitor(SIMPLE_URL).then(([aTab, aDebuggee, aMonitor]) => {
    info("Starting test... ");

    let { document, $, NetMonitorView, RequestCollection } = aMonitor.panelWin;
    let { RequestsMenu, Sidebar } = NetMonitorView;
    let detailsPane = $("#details-pane");
    let detailsPaneToggleButton = $('#details-pane-toggle');
    let clearButton = $('#requests-menu-clear-button');

    RequestsMenu.lazyUpdate = false;

    // Make sure we start in a sane state
    assertNoRequestState(RequestCollection, detailsPaneToggleButton);

    // Load one request and assert it shows up in the lis
    aMonitor.panelWin.once(aMonitor.panelWin.EVENTS.NETWORK_EVENT, () => {
      assertSingleRequestState(RequestCollection, detailsPaneToggleButton);

      // Click clear and make sure the requests are gone
      EventUtils.sendMouseEvent({ type: "click" }, clearButton);
      assertNoRequestState(RequestCollection, detailsPaneToggleButton);

      // Load a second request and make sure they still show up
      aMonitor.panelWin.once(aMonitor.panelWin.EVENTS.NETWORK_EVENT, () => {
        assertSingleRequestState(RequestCollection, detailsPaneToggleButton);

        // Make sure we can now open the details pane
        Sidebar.toggle(true);
        ok(!detailsPane.hasAttribute("pane-collapsed") &&
          !detailsPaneToggleButton.hasAttribute("pane-collapsed"),
          "The details pane should be visible after clicking the toggle button.");

        // Click clear and make sure the details pane closes
        EventUtils.sendMouseEvent({ type: "click" }, clearButton);
        assertNoRequestState(RequestCollection, detailsPaneToggleButton);
        ok(detailsPane.hasAttribute("pane-collapsed") &&
          detailsPaneToggleButton.hasAttribute("pane-collapsed"),
          "The details pane should not be visible clicking 'clear'.");

        teardown(aMonitor).then(finish);
      });

      aDebuggee.location.reload();
    });

    aDebuggee.location.reload();
  });

  /**
   * Asserts the state of the network monitor when one request has loaded
   */
  function assertSingleRequestState(RequestCollection, detailsPaneToggleButton) {
    is(RequestCollection.length, 1,
      "The request menu should have one item at this point.");
    is(detailsPaneToggleButton.hasAttribute("disabled"), false,
      "The pane toggle button should be enabled after a request is made.");
  }

  /**
   * Asserts the state of the network monitor when no requests have loaded
   */
  function assertNoRequestState(RequestCollection, detailsPaneToggleButton) {
    is(RequestCollection.length, 0,
      "The request menu should be empty at this point.");
    is(detailsPaneToggleButton.hasAttribute("disabled"), true,
      "The pane toggle button should be disabled when the request menu is cleared.");
  }
}
