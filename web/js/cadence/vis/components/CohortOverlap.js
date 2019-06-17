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
            let margin = { top: 1, left: 0, bottom: 1, right: 0 };
            this.innerWidth = function() { return this.width - margin.left - margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - margin.top - margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Create groups for rendering layers
            g.append("g").attr("class", "labels");
            g.append("g").attr("class", "rects");
            g.append("g").attr("class", "lines");

            // Tooltip
            let percentFormat = d3.format(".0%");

            this.tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function (d) {
                    return (d.cohort.baseline ? "<div><strong>BASELINE</strong></div>" :
                        d.cohort.focus ? "<div><strong>FOCUS</strong></div>" : "") +
                        "<hr>" +
                        "<div>Size: " + d.count + "</div>" +
                        "<div>Overlap: " + d.overlap + " (" + percentFormat(d.overlap / d.count) + ")</div>";
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

        init(init_data) {
            // Store a reference to the data.
            this.data = init_data;

            this.render();
        }

        update(update_data) {
            // Store a reference to the data
            this.data = update_data;

            this.render();
        }

        // The render function, which should update all elements of this visualization.
        render() {
            if (this.data.focusDistance === undefined) return;

            let baseline = this.data.cohorts[this.data.baseline];
            let focus = this.data.cohorts[this.data.focus];

            let s1 = baseline.stats.size;
            let s2 = focus.stats.size;
            let ix = this.data.focusDistance.intersection;

            let total = s1 + s2 - ix;

            let xScale = d3.scaleLinear()
                .domain([0, total])
                .range([45, this.innerWidth() - 35]);

            let groups = [
                { cohort: baseline, start: 0, count: s1, overlap: ix },
                { cohort: focus, start: total - s2, count: s2, overlap: ix }
            ];

            let overlap = { start: total - s2, count: ix };

            var h = this.innerHeight();

            // Update labels
            var labels = this.svg.select(".labels").selectAll("text")
                .data(["Baseline", "Focus"]);

            labels.enter().append("text")
                .text(function(d) { return d; })
                .style("font-size", "10px")
                .style("font-weight", "normal")
                .style("dominant-baseline", "middle")
              .merge(labels)
                .attr("x", function(d, i) {
                    return i === 0 ? 0 : xScale.range()[1] + 5;
                })
                .attr("y", function(d, i) {
                    return i === 0 ? h * 0.25 : h * 0.75;
                });

            // Bind data for rectangles
            let rect = this.svg.select(".rects").selectAll("rect")
                .data(groups);

            // Enter
            let rectEnter = rect.enter().append("rect")
                .attr("y", function(d, i) {
                    return i === 0 ? 0 : h / 2;
                })
                .style("fill", "#ccc")
                .style("stroke", "#999")
                .style("stroke-width", 2)
                .on("mouseover", this.tip.show)
                .on("mouseout", this.tip.hide);

            // Enter + update
            rectEnter.merge(rect).transition()
                .attr("x", function(d) {
                    return xScale(d.start);
                })
                .attr("width", function(d) {
                    return xScale(d.count) - xScale(0);
                })
                .attr("height", this.innerHeight() / 2);

            // Exit
            rect.exit().remove();

            // Bind data for lines
            let line = this.svg.select(".lines").selectAll("line")
                .data([overlap, overlap]);

            // Enter
            let lineEnter = line.enter().append("line")
                .style("stroke", function(d, i) {
                    return i === 0 ? "#ccc" : "#999";
                })
                .style("stroke-width", 2)
                .style("stroke-dasharray", function(d, i) {
                    return i === 0 ? null : "5 5";
                });

            // Enter + update
            lineEnter.merge(line).transition()
                .attr("x1", function(d) {
                    return xScale(d.start) + 1;
                })
                .attr("y1", h / 2)
                .attr("x2", function(d) {
                    return xScale(d.start + d.count) - 1;
                })
                .attr("y2", h / 2);

            // Exit
            line.exit().remove();
        }
    }
})
