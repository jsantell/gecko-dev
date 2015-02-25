/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { RequestModel } = require("devtools/netmonitor/request-model");
const types = require("devtools/netmonitor/types");
const utils = require("devtools/netmonitor/utils");
const { remove, unique, has } = require("sdk/util/array");

/**
 * Predicates used when sorting items.
 *
 * @param object aFirst
 *        The first item used in the comparison.
 * @param object aSecond
 *        The second item used in the comparison.
 * @return number
 *         -1 to sort aFirst to a lower index than aSecond
 *          0 to leave aFirst and aSecond unchanged with respect to each other
 *          1 to sort aSecond to a lower index than aFirst
 */
const SORTING = {
  waterfall: (first, second) => first.startedMillis > second.startedMillis,
  status: (first, second) => first.status == second.status ?
                             first.startedMillis > second.startedMillis :
                             first.status > second.status,
  method: (first, second) => first.method == second.method ?
                             first.startedMillis > second.startedMillis :
                             first.method > second.method,
  file: (first, second) => {
    let firstUrl = utils.getUriNameWithQuery(first.url).toLowerCase();
    let secondUrl = utils.getUriNameWithQuery(second.url).toLowerCase();
    return firstUrl == secondUrl
      ? first.startedMillis > second.startedMillis
      : firstUrl > secondUrl;
  },
  domain: (first, second) => {
    let firstDomain = utils.getUriHostPort(first.url).toLowerCase();
    let secondDomain = utils.getUriHostPort(second.url).toLowerCase();
    return firstDomain == secondDomain ?
           first.startedMillis > second.startedMillis :
           firstDomain > secondDomain;
  },
  type: (first, second) => {
    let firstType = utils.getAbbreviatedMimeType(first.mimeType).toLowerCase();
    let secondType = utils.getAbbreviatedMimeType(second.mimeType).toLowerCase();
    return firstType == secondType ?
      first.startedMillis > second.startedMillis :
      firstType > secondType;
  },
  transferred: (first, second) => first.transferredSize > second.transferredSize,
  size: (first, second) => first.contentSize > second.contentSize
};

const FILTERS = {
  all: () => true,
  html: types.isHtml,
  css: types.isCss,
  js: types.isJs,
  xhr: types.isXHR,
  fonts: types.isFont,
  images: types.isImage,
  media: types.isMedia,
  flash: types.isFlash,
  other: types.isOther
};

/**
 * Model representing a request. Adding and destroying Requests
 * should be performed through the Request collection.
 *
 * Events:
 * - `change`: Emitted when a property changes. Args: `this, prop, value`
 * - `sort`: Emitted when the collection is sorted.
 * - `filtered`: Emitted when a filter is added or removed.
 * - `reset`: Emitted when all models are cleared.
 */
const RequestCollection = exports.RequestCollection = Class({
  extends: EventTarget,
  model: RequestModel,

  firstRequestStartedMillis: -1,
  lastRequestEndedMillis: -1,

  initialize: function (models) {
    this.models = [];
    this._filters = ["all"];
    this._onModelEvent = this._onModelEvent.bind(this);
    this._comparator = SORTING.waterfall;

    // Wrap the emit function to not emit events if
    // the collection becomes disabled.
    this.emit = (...args) => {
      if (!this._disabled) {
        emit.apply(null, [this, ...args]);
      }
    };
  },

  /**
   * Takes a type and checks to see if it's a valid filter type, like
   * "js", "html", "all", etc.
   */
  isValidFilterType: (type) => has(Object.keys(FILTERS), type),

  /**
   * Get the total duration from the start of the first request
   * to the end of the last request for all requests in the collection.
   */
  getDuration: function () {
    return this.lastRequestEndedMillis - this.firstRequestStartedMillis;
  },

  /**
   * Disables the collection, preventing all events from being
   * emitted.
   */
  disable: function () {
    this._disabled = true;
  },

  /**
   * Set a text filter for all requests, matching requests whose URL contains the query.
   */
  setURLFilter: function (query) {
    this._urlFilter = query;
    this._invalidateFilterCache();
    this.emit("filtered");
  },

  /**
   * Overwrite all other filters and set filters only
   * described in `filters`. See @addFilter for filter options. Takes
   * a string or an array.
   */
  setFilter: function (filters, options={}) {
    filters = [].concat(filters).filter(this.isValidFilterType);
    this._filters = filters;
    this._normalizeFilters();
    this._invalidateFilterCache();
    if (!options.silent) {
      this.emit("filtered");
    }
  },

  /**
   * Adds a filter type to the collection. Takes a string, or an array of strings
   * of types "all", "html", "css", "js", "xhr", "fonts", "images",
   * "media", "flash" or "other".
   */
  addFilter: function (filters, options={}) {
    // Special case of adding "all" filter, remove all other filters
    if (filters === "all") {
      return this.setFilter("all", options);
    }
    filters = [].concat(filters).filter(this.isValidFilterType);
    this._filters = unique(this._filters.concat(filters));
    this._normalizeFilters();
    this._invalidateFilterCache();
    if (!options.silent) {
      this.emit("filtered");
    }
  },

  /**
   * Removes a filter from stored filters. Takes a string or an array of strings.
   * See @addFilter for valid filter types.
   */
  removeFilter: function (filters, options={}) {
    [].concat(filters).forEach(remove.bind(null, this._filters));
    this._normalizeFilters();
    this._invalidateFilterCache();
    if (!options.silent) {
      this.emit("filtered");
    }
  },

  /**
   * Ensures that if we have no filters left, add an "all" filter,
   * and if we have other filters, ensure that no "all" filter is on.
   */
  _normalizeFilters: function () {
    // If no filters left, ensure the "all" filter is on.
    if (this._filters.length === 0) {
      this._filters.push("all");
    }
    // If we have non-all filters, remove the "all" filter.
    else if (has(this._filters, "all") && this._filters.length > 1) {
      remove(this._filters, "all");
    }
  },

  /**
   * Returns an array of the currently active filters.
   */
  getFilters: function () {
    return this._filters;
  },

  /**
   * Returns a boolean indicating whether this collection
   * has the applied filter or not.
   */
  hasFilter: function (filter) {
    return !!~this._filters.indexOf(filter);
  },

  /**
   * Returns a filtered, new array of the collection based off of set filters.
   * Takes advantage of caching.
   */
  getFiltered: function () {
    if (this._cachedFilteredModels) {
      return this._cachedFilteredModels;
    }
    return this._cachedFilteredModels = this.models.filter(this.getFilterPredicate());
  },

  /**
   * Gets the function used to determine if models are valid within the current filter.
   * Takes advantage of caching.
   */
  getFilterPredicate: function () {
    if (this._cachedFilterPredicate) {
      return this._cachedFilterPredicate;
    }

    return this._cachedFilterPredicate = (model) => {
      return model.matchesQuery(this._urlFilter) &&
             this._filters.some(filterName => FILTERS[filterName](model));
    };
  },

  _invalidateFilterCache: function () {
    this._cachedFilteredModels = this._cachedFilterPredicate = null;
  },

  update: function (id, data) {
    let model = this.findWhere({ id: id });
    if (model) {
      model.set(data);
    }
  },

  add: function (data) {
    let request = new this.model(data);
    request.collection = this;

    this.models.push(request);

    request.on("*", this._onModelEvent);
    this.emit("add", request);

    this._updateMaxima(request.startedMillis);

    // After adding the model, add `startedDeltaMillis` to normalize it
    // with other models in the collection, based off of `firstRequestStartedMillis`.
    request.startedDeltaMillis = request.startedMillis - this.firstRequestStartedMillis;

    // Sort with new model added. Wonder if this will be costly.
    this.sort({ silent: true });

    // Delete cached filter as we don't know if this new model is in the filter group
    // or not yet. Will be refreshed on next getFiltered() call.
    this._invalidateFilterCache();

    return request;
  },

  /**
   * Updates the times of the first or last request based on time for
   * all models in the collection.
   *
   * @params number unixTime
   *         The time in milliseconds to check if this is the first or last time of the collection.
   */
  _updateMaxima: function (unixTime) {
    if (unixTime > this.lastRequestEndedMillis) {
      this.lastRequestEndedMillis = unixTime;
    }
    if (this.firstRequestStartedMillis === -1) {
      this.firstRequestStartedMillis = unixTime;
    }
  },

  reset: function () {
    this.firstRequestStartedMillis = this.lastRequestEndedMillis = -1;
    this.models = [];
    this._invalidateFilterCache();
    this.emit("reset");
  },

  remove: function (request) {
    remove(this.models, request);
    this.emit("remove", request);
  },

  /**
   * Set the sort for this collection. Takes a `sortName`, like the functions
   * in `SORTING`, like "status", "method", "file", "domain", "type", "transferred",
   * "size" or "waterfall". Second argument is whether or not this is descending. Defaults
   * to ascending.
   */
  sortBy: function (sortName, isDescending) {
    let sorter = SORTING[sortName] || SORTING.waterfall;
    this._comparator = isDescending ? ((a, b) => !sorter(a, b)) : sorter;
    this.sort();
  },

  sort: function (options={}) {
    this.models = this.models.sort(this._comparator);
    if (!options.silent) {
      this.emit("sort");
    }
  },

  /**
   * Retrieve a model from the collection via `id`.
   */
  get: function (id) {
    return this.findWhere({ id: id });
  },

  /**
   * Retrieve a model from the collection via an `index`. Ordered by creation time,
   * and does not consider filtered views.
   */
  at: function (index) {
    return this.models[index];
  },

  /**
   * Takes a hash. Return the first object in the
   * collection that matches the values in the hash.
   * From Backbone.Collection#findWhere
   * http://backbonejs.org/#Collection-findWhere
   */
  findWhere: function (attrs) {
    let keys = Object.keys(attrs);
    for (let model of this.models) {
      if (keys.every(key => model[key] === attrs[key])) {
        return model;
      }
    }
    return void 0;
  },

  _onModelEvent: function (eventName, model, ...args) {
    if (eventName === "change" && args[0] === "totalTime") {
      this._updateMaxima(model.endedMillis);
    }
    this.emit(eventName, model, ...args);
  },

  get length() {
    return this.models.length;
  },

  // TODO
  // Exposed functions that interface with widget attachments (filter, sorting) assume
  // that the model is stored under the `attachment` property. This just exposes
  // a mapping so you can wrap the filterPredicate or comparator in this to get the
  // real model, not the widget item. Once removing the widget item list in TableRenderer,
  // this can be removed.
  //
  // Example in TableRenderer:
  // this.filterContents(widgetify(RequestCollection.getFilterPredicate()));
  // this.sortContents(widgetify(RequestCollection._comparator));
  widgetify: function (fn) {
    return function (...args) {
      return fn.apply(null, args.map(({ attachment }) => attachment));
    }
  }
});
