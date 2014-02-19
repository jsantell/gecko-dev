/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";


// Globals for d3 stuff
const WIDTH = 500;
const HEIGHT = 400;

/**
 * Functions handling the sources UI.
 */
let WebAudioGraphView = {
  /**
   * Initialization function, called when the tool is started.
   */
  initialize: function() {
  },

  /**
   * Destruction function, called when the tool is closed.
   */
  destroy: function() {
  },

  /**
   * Called when a page is reloaded and waiting for a "start-context" event
   * and clears out old content
   */
  resetUI: function () {
    $("#reload-notice").hidden = true;
    $("#waiting-notice").hidden = false;
    $("#content").hidden = true;
    // TODO remove SVG data
  },

  /**
   * Called once "start-context" is fired, indicating that there is audio context
   * activity to view and inspect
   */
  showContent: function () {
    $("#reload-notice").hidden = true;
    $("#waiting-notice").hidden = true;
    $("#content").hidden = false;
    this.refresh();
  },

  refresh: function () {
    this.draw();
  },

  resetGraph: function () {
    $("#graph").innerHTML = "";
  },

  draw: function () {
    console.log("DRAW");
    //graphNodes.forEach(node => Object.keys(node).forEach(key => console.log(key, node[key])));
    //graphEdges.forEach(node => Object.keys(node).forEach(key => console.log(key, node[key])));

    console.log('Node count: ', graphNodes.length);
    console.log('Edge count: ', graphEdges.length);
    // Clear out previous SVG information
    this.resetGraph();

    let force = d3.layout.force()
      .nodes(graphNodes)
      .links(graphEdges)
      .size([WIDTH, HEIGHT])
      .linkDistance(60)
      .charge(-300)
      .on("tick", tick)
      .start();

    let svg = d3.select("#graph")
      .attr("width", WIDTH)
      .attr("height", HEIGHT);

    // Per-type markers, as they don't inherit styles.
    svg.append("defs").selectAll("marker")
      .data(["enabled"])
      .enter().append("marker")
      .attr("id", function(d) { return d; })
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", -1.5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5");

    var path = svg.append("g").selectAll("path")
      .data(force.links())
      .enter().append("path")
      //.attr("class", function(d) { return "link " + d.type; })
      //.attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
      .attr("class", function(d) { return "link enabled"; })
      .attr("marker-end", function(d) { return "url(#" + "enabled" + ")"; });
 
    var circle = svg.append("g").selectAll("circle")
      .data(force.nodes())
      .enter().append("circle")
      .attr("r", 6)
      .call(force.drag);
 
    var text = svg.append("g").selectAll("text")
      .data(force.nodes())
      .enter().append("text")
      .attr("x", 8)
      .attr("y", ".31em")
      .text(function(d) { return d.type; });

    // Use elliptical arc path segments to doubly-encode directionality.
    function tick() {
      path.attr("d", linkArc);
      circle.attr("transform", transform);
      text.attr("transform", transform);
    }
  }
};

/**
 * DOM query helper.
 */
function $(selector, target = document) { return target.querySelector(selector); }

/**
 * Rendering utils
 */
function linkArc(d) {
  var dx = d.target.x - d.source.x,
  dy = d.target.y - d.source.y,
  dr = Math.sqrt(dx * dx + dy * dy);
  return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
}

function transform(d) {
  return "translate(" + d.x + "," + d.y + ")";
}
