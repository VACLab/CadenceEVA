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
                    let e = d.stats.events[self.event.id];
                    let n1 = !e ? 0 : e.entitycount;
                    let n2 = d.stats.size;

                    return "<div>Cohort size: " + n2 + "</div>" +
                        "<hr>" +
                        "<div>Event count: " + n1 + " (" + percentFormat(n1 / n2) + ")";
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

        init(data, event) {
            // Store a reference to the data.
            this.data = data;
            this.event = event;

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

            let bandScale = d3.scaleBand()
                .domain([0, 1])
                .rangeRound([0, this.innerWidth()])
                .padding(0.1);

            let xScale = d3.scaleLinear()
                .domain([0, 1])
                .range([0, bandScale.bandwidth()]);

            let barHeight = this.innerHeight() / 2;
            let barY = this.innerHeight() / 2 - barHeight / 2;

            // Update title
            this.svg.select(".title")
                .text(self.event.cat + "-" + self.event.code + ", " + self.event.label)
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

            // Enter
            let barEnter = bar.enter().append("g")
                .attr("class", "bar")
                .on("mouseover", function (d) {
                    self.tip.show(d);
                })
                .on("mouseout", function (d) {
                    self.tip.hide();
                });

            barEnter.append("rect")
                .attr("class", "cohort")
                .style("fill", "none")
                .style("stroke", "#999")
                .style("stroke-width", 2)
                .style("pointer-events", "all");

            barEnter.append("rect")
                .attr("class", "event")
                .style("fill", "#ccc")
                .style("stroke", "#999")
                .style("stroke-width", 2)
                .style("pointer-events", "none");

            // Enter + update
            let barUpdate = barEnter.merge(bar)
                .attr("transform", function(d, i) {
                    return "translate(" + bandScale(i) + "," + barY + ")";
                });

            barUpdate.selectAll(".cohort")
                .attr("width", bandScale.bandwidth())
                .attr("height", barHeight);

            barUpdate.selectAll(".event")
                .attr("width", function(d) {
                    return xScale(eventProportion(d));
                })
                .attr("height", barHeight);

            // Exit
            bar.exit().remove();

            function eventProportion(d) {
                let e = d.stats.events[self.event.id];

                return !e ? 0 : e.entitycount / d.stats.size;
            }
        }
    }
})
