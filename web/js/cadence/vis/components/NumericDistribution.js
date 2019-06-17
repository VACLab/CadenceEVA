"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/on",
    "dijit/registry",
    "dojo/aspect",
    "vaclab/VaclabVis"
], (declare, lang, dom, domStyle, dojoOn, registry, aspect, VaclabVis) => {
    return class extends VaclabVis {

        constructor(dom_container_id) {
            super(dom_container_id, []);

            let self = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Color
            this.highlightColor = "black";

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);

            // Margins
            let margin = {top: 12, left: 0, bottom: 11, right: 0};
            this.innerWidth = function() { return this.width - margin.left - margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - margin.top - margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            // Add group for labels at the bottom
            this.svg.append("g").attr("class", "labels");

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Add title text
            g.append("text").attr("class", "title")
                .attr("dy", "-.3em")
                .style("font-size", "10px")
                .style("font-weight", "normal")
                .style("text-anchor", "middle");

            // Add groups for rendering layers
            g.append("g").attr("class", "bars");

            // Create tooltips
            let percentFormat = d3.format(".0%");

            this.tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function(d) {
                    let n1 = d.cohort.stats.attrs[self.attribute.code].stats[d.value];
                    n1 = !n1 ? 0 : n1;

                    let n2 = d.cohort.stats.size;

                    return "<div>Cohort size: " + n2 + "</div>" +
                        "<hr>" +
                        "<div>Value: " + d.value + "</div>" +
                        "<div>Count: " + n1 + " (" + percentFormat(n1 / n2) + ")";
                });

            this.svg.call(this.tip);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height;

            // Update the SVG element
            this.svg
                .attr("height", this.height)
                .attr("width", this.width);

            // Trigger a re-render
            this.render();
        }

        init(data, attribute) {
            // Store a reference to the data.
            this.data = data;
            this.attribute = attribute;

            this.render();
        }

        update(data) {
            // Store a reference to the data
            this.data = data;

            this.render();
        }

        // The render function, which should update all elements of this visualization.
        render() {
            let self = this;

            let baseline = this.data.cohorts[this.data.baseline];
            let focus = this.data.cohorts[this.data.focus];

            function getValues(d) {
                return d3.keys(d.stats.attrs[self.attribute.code].stats).map(function(d) {
                    return +d;
                });
            }

            let valueExtent = d3.extent(getValues(baseline).concat(getValues(focus)));

            let bandScale = d3.scaleBand()
                .domain([0, 1])
                .rangeRound([0, this.innerWidth()])
                .padding(0.1);

            let segmentScale = d3.scaleBand()
                .domain(d3.range(valueExtent[0], valueExtent[1] + 1))
                .rangeRound([0, bandScale.bandwidth()])
                .round(true);

            let barHeight = this.innerHeight();

            // Update title
            this.svg.select(".title")
                .text(self.attribute.label)
                .attr("x", self.innerWidth() / 2);

            // Update labels
            let labels = this.svg.select(".labels").selectAll("text")
                .data(["Baseline", "Focus"]);

            labels.enter().append("text")
                .text(function(d) { return d; })
                .attr("y", this.height)
                .style("font-size", "10px")
                .style("font-weight", "normal")
                .style("text-anchor", "middle")
              .merge(labels)
                .attr("x", function(d, i) {
                    return bandScale(i) + bandScale.bandwidth() / 2;
                });

            // Bind data for bars
            let bar = this.svg.select(".bars").selectAll(".bar")
                .data([baseline, focus]);

            // Enter + update
            bar.enter().append("g")
                .attr("class", "bar")
              .merge(bar)
                .attr("transform", function(d, i) {
                    return "translate(" + bandScale(i) + ",0)";
                })
                .each(function(d) {
                    let maxCount = d3.max(d3.values(d.stats.attrs[self.attribute.code].stats));

                    // Create y scale
                    let yScale = d3.scaleLinear()
                        .domain([0, maxCount])
                        .range([barHeight, 0]);

                    // Bind data
                    let segment = d3.select(this).selectAll(".segment")
                        .data(segmentScale.domain());

                    // Enter + update
                    segment.enter().append("rect")
                        .attr("class", "segment")
                        .style("fill", "#999")
                        .style("stroke", "none")
                        .style("pointer-events", "all")
                        .on("mouseover", function (e) {
                            highlight(e);

                            self.tip.show({
                                cohort: d,
                                value: e
                            });
                        })
                        .on("mouseout", function (e) {
                            highlight(null);

                            self.tip.hide();
                        })
                      .merge(segment)
                        .attr("x", function(e) {
                            return segmentScale(e);
                        })
                        .attr("y", function(e) {
                            return yScale(value(e));
                        })
                        .attr("width", segmentScale.bandwidth())
                        .attr("height", function(e) {
                            return barHeight - yScale(value(e));
                        });

                    // Exit
                    segment.exit().remove();

                    function value(e) {
                        let v = d.stats.attrs[self.attribute.code].stats[e];

                        return !v ? 0 : v;
                    }

                    function highlight(d) {
                        self.svg.select(".bars").selectAll(".segment")
                            .style("fill", function(e) {
                                return e === d ? self.highlightColor : "#999";
                            });
                    }
                });

            // Exit
            bar.exit().remove();
        }
    }
})
