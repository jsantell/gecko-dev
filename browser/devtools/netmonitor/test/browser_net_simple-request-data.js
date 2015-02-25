/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if requests render correct information in the menu UI.
 */

function spawnTest () {
  let [aTab, aDebuggee, aMonitor] = yield initNetMonitor(SIMPLE_SJS);
  info("Starting test... ");

  let { panelWin: win } = aMonitor;
  let { L10N, NetMonitorView, EVENTS, RequestCollection, window } = win;
  let { RequestsMenu } = NetMonitorView;

  RequestsMenu.lazyUpdate = false;

  let networkEvent = waitFor(window, EVENTS.NETWORK_EVENT);
  let updatingResponseContent = waitFor(window, EVENTS.UPDATING_RESPONSE_CONTENT);
  let receivedRequestHeaders = waitFor(window, EVENTS.RECEIVED_REQUEST_HEADERS);
  let receivedRequestCookies = waitFor(window, EVENTS.RECEIVED_REQUEST_COOKIES);
  let receivedResponseHeaders = waitFor(window, EVENTS.RECEIVED_RESPONSE_HEADERS);
  let receivedResponseCookies = waitFor(window, EVENTS.RECEIVED_RESPONSE_COOKIES);
  let startedReceivingResponse = waitFor(window, EVENTS.STARTED_RECEIVING_RESPONSE);
  let receivedResponseContent = waitFor(window, EVENTS.RECEIVED_RESPONSE_CONTENT);
  let updatingEventTimings = waitFor(window, EVENTS.UPDATING_EVENT_TIMINGS);
  let receivedEventTimings = waitFor(window, EVENTS.RECEIVED_EVENT_TIMINGS);

  aDebuggee.location.reload();

  yield networkEvent;

  is(RequestsMenu.selectedRequest, null,
    "There shouldn't be any selected item in the requests menu.");
  is(RequestCollection.length, 1,
    "The requests menu should not be empty after the first request.");
  is(NetMonitorView.detailsPaneHidden, true,
    "The details pane should still be hidden after the first request.");

  let requestItem = RequestCollection.at(0);

  is(typeof requestItem.id, "string",
    "The attached request id is incorrect.");
  isnot(requestItem.id, "",
    "The attached request id should not be empty.");

  is(typeof requestItem.startedDeltaMillis, "number",
    "The attached startedDeltaMillis is incorrect.");
  is(requestItem.startedDeltaMillis, 0,
    "The attached startedDeltaMillis should be zero.");

  is(typeof requestItem.startedMillis, "number",
    "The attached startedMillis is incorrect.");
  isnot(requestItem.startedMillis, 0,
    "The attached startedMillis should not be zero.");

  is(requestItem.requestHeaders, undefined,
    "The requestHeaders should not yet be set.");
  is(requestItem.requestCookies, undefined,
    "The requestCookies should not yet be set.");
  is(requestItem.requestPostData, undefined,
    "The requestPostData should not yet be set.");

  is(requestItem.responseHeaders, undefined,
    "The responseHeaders should not yet be set.");
  is(requestItem.responseCookies, undefined,
    "The responseCookies should not yet be set.");

  is(requestItem.httpVersion, undefined,
    "The httpVersion should not yet be set.");
  is(requestItem.status, undefined,
    "The status should not yet be set.");
  is(requestItem.statusText, undefined,
    "The statusText should not yet be set.");

  is(requestItem.headersSize, undefined,
    "The headersSize should not yet be set.");
  is(requestItem.transferredSize, undefined,
    "The transferredSize should not yet be set.");
  is(requestItem.contentSize, undefined,
    "The contentSize should not yet be set.");

  is(requestItem.mimeType, undefined,
    "The mimeType should not yet be set.");
  is(requestItem.responseContent, undefined,
    "The responseContent should not yet be set.");

  is(requestItem.totalTime, undefined,
    "The totalTime should not yet be set.");
  is(requestItem.eventTimings, undefined,
    "The eventTimings should not yet be set.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS);

  yield receivedRequestHeaders;

  ok(requestItem.requestHeaders,
    "There should be a requestHeaders attachment available.");
  is(requestItem.requestHeaders.headers.length, 9,
    "The requestHeaders attachment has an incorrect |headers| property.");
  isnot(requestItem.requestHeaders.headersSize, 0,
    "The requestHeaders attachment has an incorrect |headersSize| property.");
  // Can't test for the exact request headers size because the value may
  // vary across platforms ("User-Agent" header differs).

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS);

  yield receivedRequestCookies;

  ok(requestItem.requestCookies,
    "There should be a requestCookies attachment available.");
  is(requestItem.requestCookies.cookies.length, 2,
    "The requestCookies attachment has an incorrect |cookies| property.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS);

  window.once(EVENTS.RECEIVED_REQUEST_POST_DATA, () => {
    ok(false, "Trap listener: this request doesn't have any post data.")
  });

  yield receivedResponseHeaders;

  ok(requestItem.responseHeaders,
    "There should be a responseHeaders attachment available.");
  is(requestItem.responseHeaders.headers.length, 10,
    "The responseHeaders attachment has an incorrect |headers| property.");
  is(requestItem.responseHeaders.headersSize, 330,
    "The responseHeaders attachment has an incorrect |headersSize| property.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS);

  yield receivedResponseCookies;

  ok(requestItem.responseCookies,
    "There should be a responseCookies attachment available.");
  is(requestItem.responseCookies.cookies.length, 2,
    "The responseCookies attachment has an incorrect |cookies| property.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS);

  yield startedReceivingResponse;

  is(requestItem.httpVersion, "HTTP/1.1",
    "The httpVersion attachment has an incorrect value.");
  is(requestItem.status, "200",
    "The status attachment has an incorrect value.");
  is(requestItem.statusText, "Och Aye",
    "The statusText attachment has an incorrect value.");
  is(requestItem.headersSize, 330,
    "The headersSize attachment has an incorrect value.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS, {
    status: "200",
    statusText: "Och Aye"
  });

  yield updatingResponseContent;

  is(requestItem.transferredSize, "12",
    "The transferredSize attachment has an incorrect value.");
  is(requestItem.contentSize, "12",
    "The contentSize attachment has an incorrect value.");
  is(requestItem.mimeType, "text/plain; charset=utf-8",
    "The mimeType attachment has an incorrect value.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS, {
    type: "plain",
    fullMimeType: "text/plain; charset=utf-8",
    transferred: L10N.getFormatStrWithNumbers("networkMenu.sizeKB", 0.01),
    size: L10N.getFormatStrWithNumbers("networkMenu.sizeKB", 0.01),
  });

  yield receivedResponseContent;

  ok(requestItem.responseContent,
    "There should be a responseContent attachment available.");
  is(requestItem.responseContent.content.mimeType, "text/plain; charset=utf-8",
    "The responseContent attachment has an incorrect |content.mimeType| property.");
  is(requestItem.responseContent.content.text, "Hello world!",
    "The responseContent attachment has an incorrect |content.text| property.");
  is(requestItem.responseContent.content.size, 12,
    "The responseContent attachment has an incorrect |content.size| property.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS, {
    type: "plain",
    fullMimeType: "text/plain; charset=utf-8",
    transferred: L10N.getFormatStrWithNumbers("networkMenu.sizeKB", 0.01),
    size: L10N.getFormatStrWithNumbers("networkMenu.sizeKB", 0.01),
  });

  yield updatingEventTimings;

  is(typeof requestItem.totalTime, "number",
    "The attached totalTime is incorrect.");
  ok(requestItem.totalTime >= 0,
    "The attached totalTime should be positive.");

  is(typeof requestItem.endedMillis, "number",
    "The attached endedMillis is incorrect.");
  ok(requestItem.endedMillis >= 0,
    "The attached endedMillis should be positive.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS, {
    time: true
  });

  yield receivedEventTimings;

  ok(requestItem.eventTimings,
    "There should be a eventTimings attachment available.");
  is(typeof requestItem.eventTimings.timings.blocked, "number",
    "The eventTimings attachment has an incorrect |timings.blocked| property.");
  is(typeof requestItem.eventTimings.timings.dns, "number",
    "The eventTimings attachment has an incorrect |timings.dns| property.");
  is(typeof requestItem.eventTimings.timings.connect, "number",
    "The eventTimings attachment has an incorrect |timings.connect| property.");
  is(typeof requestItem.eventTimings.timings.send, "number",
    "The eventTimings attachment has an incorrect |timings.send| property.");
  is(typeof requestItem.eventTimings.timings.wait, "number",
    "The eventTimings attachment has an incorrect |timings.wait| property.");
  is(typeof requestItem.eventTimings.timings.receive, "number",
    "The eventTimings attachment has an incorrect |timings.receive| property.");
  is(typeof requestItem.eventTimings.totalTime, "number",
    "The eventTimings attachment has an incorrect |totalTime| property.");

  verifyRequestItemTarget(win, requestItem, "GET", SIMPLE_SJS, {
    time: true
  });

  yield teardown(aMonitor);
  finish();
};
