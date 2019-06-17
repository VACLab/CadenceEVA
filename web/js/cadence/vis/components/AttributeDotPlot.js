"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/on",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/aspect",
    "vaclab/VaclabVis"
], (declare, lang, dom, domStyle, dojoOn, registry, Menu, MenuItem, aspect, VaclabVis) => {
    return class extends VaclabVis {

        constructor(dom_container_id) {
            super(dom_container_id, ["select"]);

            let self = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Selection
            this.selectedAttribute = null;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = 0;

            // Margins
            this.pointRadius = 5;
            let m = this.pointRadius + 1;
            this.margin = { top: m, left: 10, bottom: m + 25, right: 15 };
            this.innerWidth = function() { return this.width - this.margin.left - this.margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - this.margin.top - this.margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .on("click", function() {
                    self.dispatcher.call("select", this, null);
                });

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

            // Create groups for rendering layers
            g.append("g").attr("class", "labels");
            g.append("g").attr("class", "axis");
            g.append("g").attr("class", "lines");
            g.append("g").attr("class", "points");

            // Tooltip
            let numberFormat = d3.format(".3f");

            this.tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function (d) {
                    const constraints = self.data.constraints.filter(d => d.code).map(d => d.code);

                    return "<div>" + d.label + "</div>" +
                        (constraints.indexOf(d.code) !== -1 ? "<div>♦ : Constraint</div>" : "") +
                        "<hr>" +
                        "<div>Distance: " + numberFormat(d.distance) + "</div>";
                });

            this.svg.call(this.tip);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;

            // Update the SVG element
            this.svg
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

        selectAttribute(attribute) {
            this.selectedAttribute = attribute;

            this.highlight(null);
        }

        // The render function, which should update all elements of this visualization.
        render() {
            let self = this;

            let attributes = this.data.attributes;
            let range = this.data.range;
            let constraints = self.data.constraints.filter(d => d.code).map(d => d.code);

            // Compute height
            let h = this.pointRadius + 1;
            this.height = attributes.length * h + this.margin.top + this.margin.bottom;
            this.svg.attr("height", this.height);

            // TODO: Switch to a d3 scheme chromatic color map?
            // TODO: Share color map across visualizations.
            let colorScale = d3.scaleLinear()
                .domain([-range.maxNonConstraintDistance, 0, range.maxNonConstraintDistance])
                .range(["#2166ac", "#999", "#b2182b"])
                .clamp(true);

            let radiusScale = d3.scaleLinear()
                .domain([0, range.maxGradientMag])
                .range([2, this.pointRadius])
                .clamp(true);

            let xScale = d3.scaleLinear()
                .domain([0, range.maxAttributeDistance])
                .range([40, this.innerWidth()]);

            let yScale = d3.scalePoint()
                .domain(d3.range(0, attributes.length))
                .range([0, this.innerHeight()]);

            drawLabels();
            drawAxis();
            drawLines();
            drawPoints();

            this.highlight();

            function drawLabels() {
                // Bind attribute data
                let label = self.svg.select(".labels").selectAll("text")
                    .data(attributes);

                // Enter
                let labelEnter = label.enter().append("text")
                    .style("dominant-baseline", "middle");

                // Update
                labelEnter.merge(label)
                    .text(d => d.label)
                    .attr("y", (d, i) => yScale(i));

                label.exit().remove();
            }

            function drawAxis() {
                let axis = d3.axisBottom(xScale);

                self.svg.select(".axis")
                    .attr("transform", "translate(0," + (self.innerHeight() + self.pointRadius * 1.5) + ")")
                    .call(axis);
            }

            function drawLines() {
                // Bind attribute data
                let line = self.svg.select(".lines").selectAll(".line")
                    .data(attributes);

                // Enter
                let lineEnter = line.enter().append("line")
                    .attr("class", "line")
                    .style("stroke", "#ccc");

                // Update
                lineEnter.merge(line)
                    .attr("x1", xScale(0))
                    .attr("y1", function(d, i) {
                        return yScale(i);
                    })
                    .attr("x2", function(d) {
                        return xScale(d.distance);
                    })
                    .attr("y2", function(d, i) {
                        return yScale(i);
                    });

                line.exit().remove();
            }

            function drawPoints() {
                // Symbol for constraints
                let symbol = d3.symbol()
                    .type(d3.symbolDiamond)
                    .size(20);

                // Bind attribute data
                let point = self.svg.select(".points").selectAll(".point")
                    .data(attributes);

                // Enter
                let pointEnter = point.enter().append("g")
                    .attr("class", "point");

                pointEnter.append("circle")
                    .on("mouseover", function(d) {
                        self.tip.show(d);
                        self.highlight(d);
                    })
                    .on("mouseout", function() {
                        self.tip.hide();
                        self.highlight();
                    })
                    .on("click", function(d) {
                        d3.event.stopPropagation();

                        self.dispatcher.call("select", this, d);
                    });

                // Enter + exit
                pointEnter.merge(point).each(function(d, i) {
                    let g = d3.select(this);

                    const x = xScale(d.distance);
                    const y = yScale(i);
                    const r = radiusScale(d.distance);

                    g.select("circle")
                        .attr("r", r)
                        .attr("cx", x)
                        .attr("cy", y)
                        .style("fill", colorScale(d.distance));

                    // Update constraint circle
                    let constrained = constraints.indexOf(d.code) !== -1;

                    let constraint = g.selectAll(".constraint")
                        .data(constrained ? [d] : []);

                    constraint.enter().append("path")
                        .attr("class", "constraint")
                        .attr("d", symbol)
                        .style("pointer-events", "none")
                        .style("fill", "black")
                      .merge(constraint)
                        .attr("transform", "translate(" + (x + r + 3) + "," + y + ")");

                    constraint.exit().remove();
                });

                // Exit
                point.exit().remove();
            }
        }

        highlight(d) {
            let self = this;

            this.svg.select(".points").selectAll(".point").select("circle")
                .style("stroke", function(e) {
                    return doHighlight(e) ? "black" : "none";
                });

            this.svg.select(".lines").selectAll(".line")
                .style("stroke", function(e) {
                    return doHighlight(e) ? "black" : "#ccc";
                });

            function doHighlight(e) {
                return e === d || e === self.selectedAttribute;
            }
        }
    }
})
