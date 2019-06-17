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

        constructor(dom_container_id, showAxis) {
            super(dom_container_id, ["select"]);

            let self = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Store the showAxis boolean
            this.showAxis = showAxis;

            // Selection
            this.selectedEvent = null;

            // Threshold
            this.gradientThreshold = 1;

            // Options
            this.collapseType = "gradientInOut";

            // Scales
            this.colorScale = d3.scaleLinear()
                .clamp(true);
            this.radiusScale = d3.scaleLinear();
            this.xScale = d3.scaleLinear();
            this.yScale = d3.scaleLinear();

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);

            // Margins
            this.pointRadius = 5;
            let m = this.pointRadius + 1;
            let margin = { top: m, left: this.showAxis ? m + 35 : m, bottom: m, right: m + 3 };
            this.innerWidth = function() { return this.width - margin.left - margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - margin.top - margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .on("click", function() {
                    self.dispatcher.call("select", this, null);
                });

            // Drop shadow filter
            this.svg.append("defs").append("filter")
                .attr("id", "dotShadow")
                .attr("width", "200%")
                .attr("height", "200%")
                .append("feDropShadow")
                .attr("dx", 2)
                .attr("dy", 2)
                .attr("stdDeviation", 2);

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Create groups for rendering layers
            if (this.showAxis) g.append("g").attr("class", "axis");
            g.append("g").attr("class", "bins");
            g.append("g").attr("class", "points");
            g.append("g").attr("class", "highlightLines");
            g.append("g").attr("class", "highlightPoints");
            g.append("g").attr("class", "constraints");
            g.append("g").attr("class", "expand");

            // Tooltip
            let numberFormat = d3.format(".3f");

            this.tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function (d) {
                    const constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

                    return "<div>" + d.data.code + ": " + d.data.label + "</div>" +
                        (constraints.indexOf(d.data.id) !== -1 ? "<div>♦ : Constraint</div>" : "") +
                        "<hr>" +
                        "<div>Distance: " + numberFormat(d.data.distance) + "</div>" +
                        "<div>Gradient: " + numberFormat(d.data.gradient) + "</div>";
                });

            this.svg.call(this.tip);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height;

            // Update the SVG element
            this.svg
                .attr("width", this.width)
                .attr("height", this.height);

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

        selectEvent(event) {
            this.selectedEvent = event;

            this.highlight();
        }

        setGradientThreshold(threshold) {
            this.gradientThreshold = threshold;

            this.render();
        }

        setOption(parameter, value) {
            let self = this;

            switch (parameter) {
                case "collapseType":
                    setCollapseType(value);
                    break;

                default:
                    console.log("Unknown parameter: " + parameter);
            }

            function setCollapseType(value) {
                switch (value) {
                    case "gradientIn":
                    case "gradientMagIn":
                    case "gradientInOut":
                        self.collapseType = value;

                        self.render();

                        break;

                    default:
                        console.log("Invalid collapse type value: " + value);
                }
            }
        }

        collapsible(node) {
            switch (this.collapseType) {
                case "gradientIn":
                    return !(node.data.gradient >= this.gradientThreshold);

                case "gradientMagIn":
                    return !(node.data.gradientMag >= this.gradientThreshold);

                case "gradientInOut":
                    return !(node.data.gradient >= this.gradientThreshold ||
                        (node.children && node.children.reduce((p, c) => p || c.data.gradient <= -this.gradientThreshold, false)));
            }
        }

        // The render function, which should update all elements of this visualization.
        render() {
            let self = this;

            let root = this.data.root;
            let range = this.data.range;

            // TODO: Switch to a d3 scheme chromatic color map?
            // TODO: Share color map across visualizations.
            this.colorScale
                .domain([-range.maxNonConstraintDistance, 0, range.maxNonConstraintDistance])
                .range(["#2166ac", "#999", "#b2182b"])
                .clamp(true);

            this.radiusScale
                .domain([0, range.maxGradientMag])
                .range([2, this.pointRadius]);

            this.xScale
                .domain([0, root.height])
                .range([0, this.innerWidth()]);

            this.yScale
                .domain([0, range.maxEventDistance])
                .range([this.innerHeight(), 0]);

            if (this.showAxis) drawAxis();
            drawPoints();
            drawBins();

            self.highlight(null);

            function drawAxis() {
                let axis = d3.axisLeft(self.yScale);

                self.svg.select(".axis")
                    .attr("transform", "translate(" + (-self.pointRadius * 1.5) + ",0)")
                    .call(axis);
            }

            function drawPoints() {
                let point = self.svg.select(".points").selectAll(".point")
                    .data(root.descendants().filter(function (d) {
                        return !self.collapsible(d);
                    }), function (d) {
                        return d.data.id;
                    });

                let pointEnter = point.enter().append("circle")
                    .attr("class", "point")
                    .style("stroke", "none")
                    .style("stroke-opacity", 0.5);

                pointEnter.merge(point).sort(function (a, b) {
                    return d3.ascending(a.data.gradientMag, b.data.gradientMag);
                }).attr("cx", function (d) {
                    return self.xScale(d.depth);
                    })
                    .attr("cy", function (d) {
                        return self.yScale(d.data.distance);
                    })
                    .attr("r", function (d) {
                        return self.radiusScale(d.data.gradientMag);
                    })
                    .style("fill", function (d) {
                        return self.colorScale(d.data.gradient);
                    })
                    .on("mouseover", function (d) {
                        self.highlight(d);
                    });

                point.exit().remove();
            }

            function drawBins() {
                const n = 20;

                let histogram = d3.histogram()
                    .domain([0, range.maxEventDistance])
                    .value(d => d.data.distance)
                    .thresholds(n - 1);

                // Generate 2D array of events by depth
                let columns = d3.range(root.height + 1).map(() => []);
                root.each(d => {
                    if (self.collapsible(d)) columns[d.depth].push(d);
                });

                columns = columns.map(d => histogram(d));

                let greyScale = d3.scaleLinear()
                    .domain([1, d3.max(columns, d => d3.max(d, d => d.length))])
                    .range(["#eee", "#bbb"]);

                // Bind column data
                let column = self.svg.select(".bins").selectAll(".column")
                    .data(columns);

                // Enter + update
                column.enter().append("g")
                    .attr("class", "column")
                  .merge(column)
                    .each(function(d, i) {
                        // Compute histogram
                        let bin = d3.select(this).selectAll(".bin")
                            .data(d.filter(d => d.length > 0));

                        let x = self.xScale(i);

                        bin.enter().append("rect")
                            .attr("class", "bin")
                            .on("mouseover", function() {
                                d3.select(this).style("stroke", "#999").raise();
                            })
                            .on("click", function() {
                                self.expand(d3.select(this));
                            })
                            .on("mouseout", function() {
                                d3.select(this).style("stroke", "none");
                            })
                          .merge(bin)
                            .attr("x", x - self.pointRadius)
                            .attr("y", d => self.yScale(d.x1))
                            .attr("width", self.pointRadius * 2)
                            .attr("height", d => Math.max(self.yScale(d.x0) - self.yScale(d.x1), 0))
                            .attr("rx", 3)
                            .attr("ry", 3)
                            .style("fill", d => greyScale(d.length));

                        bin.exit().remove();
                    });

                column.exit().remove();
            }
        }

        expand(selection) {
            let self = this;

            let pack = d3.pack()
                .radius(d => self.radiusScale(d.data.data.gradientMag))
                .size([0, 0])
                .padding(1);

            let bin = this.svg.select(".expand").selectAll(".bin")
                .data(selection ? [selection] : []);

            // Enter + update
            bin.enter().append("g")
                .attr("class", "bin")
                .on("mouseleave", () => self.expand(null))
                .each(function(d) {
                    let g = d3.select(this);

                    g.append("rect")
                        .attr("class", "backdrop")
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("fill", "white")
                        .style("fill-opacity", 0.8)
                        .style("stroke", "black")
                        .style("filter", "url(#dotShadow)");

                    g.append("g").attr("class", "points");
                })
              .merge(bin)
                .each(function(d) {
                    let g = d3.select(this);

                    // Get position of bin
                    let x = +d.attr("x");
                    let y = +d.attr("y");
                    let w = +d.attr("width");
                    let h = +d.attr("height");
                    x += w / 2;
                    y += h / 2;

                    // Sort points for this bin
                    let points = d.datum().sort((a, b) => d3.descending(a.data.gradientMag, b.data.gradientMag));

                    // Compute layout
                    let nx = Math.ceil(Math.sqrt(points.length));
                    let ny = Math.ceil(points.length / nx);
                    let r = d3.max(points, d => self.radiusScale(d.data.gradientMag));

                    let pad = 1;
                    let width = (r * 2 + pad) * (nx - 1);
                    let height = (r * 2 + pad) * (ny - 1);

                    // Try to fit if too big
                    while (width > self.innerWidth() - w / 2) {
                        nx--;
                        ny = Math.ceil(points.length / nx);
                        width = (r * 2 + pad) * (nx - 1);
                        height = (r * 2 + pad) * (ny - 1);
                    }

                    x -= width / 2;
                    y -= height / 2;

                    let margin = r + 5;

                    // Shift if overlapping edge of view
                    if (x - margin < 0 - w / 2) x = -w / 2 + margin;
                    if (x + width + margin > self.innerWidth() + w / 2) x = self.innerWidth() + w / 2 - width - margin;
                    if (y - margin < 0 - w / 2) y = - w / 2 + margin;
                    if (y + height + margin > self.innerHeight() + w / 2) y = self.innerHeight() + w / 2 - height - margin;

                    // Scales
                    let columnScale = d3.scaleLinear()
                        .domain([0, nx - 1])
                        .range([x, x + width]);

                    let rowScale = d3.scaleLinear()
                        .domain([0, ny - 1])
                        .range([y, y + height]);

                    // Update the backdrop
                    g.select(".backdrop")
                        .attr("x", x - margin)
                        .attr("y", y - margin)
                        .attr("width", width + margin * 2)
                        .attr("height", height + margin * 2);

                    // Bind point data
                    let point = g.select(".points").selectAll(".point")
                        .data(points);

                    // Enter + update
                    point.enter().append("circle")
                        .attr("class", "point")
                        .on("mouseover", function(d) {
                            self.tip.show(d);
                            self.highlight(d);

                            d3.select(this).style("stroke", "black");
                        })
                        .on("mouseout", function(d) {
                            self.tip.hide();
                            self.highlight(null);

                            d3.select(this).style("stroke", "none");
                        })
                        .on("click", d => {
                            d3.event.stopPropagation();

                            self.tip.hide();

                            self.expand(null);

                            self.dispatcher.call("select", this, d.data);
                        })
                      .merge(point)
                        .attr("cx", (d, i) => columnScale(i % nx))
                        .attr("cy", (d, i) => rowScale(Math.floor(i / nx)))
                        .attr("r", d => self.radiusScale(d.data.gradientMag))
                        .style("fill", d => self.colorScale(d.data.gradient));

                    // Exit
                    point.exit().remove();
                });

            // Exit
            bin.exit().remove();
        }

        highlight(d) {
            let self = this;

            let node = this.selectedEvent ? this.data.root.descendants().filter(function(d) {
                return d.data.id === self.selectedEvent.id;
            })[0] : d;

            if (node) {
                let nodes = node.ancestors().reverse().concat(node.descendants().slice(1));
                let addNode = d && nodes.indexOf(d) === -1;

                self.svg.select(".points").selectAll(".point")
                    //.style("fill-opacity", 0.1);
                    .style("fill", "none")
                    .style("stroke", d => self.colorScale(d.data.gradient));

                drawHighlightPoints(addNode ? nodes.concat(d) : nodes);
                drawHighlightLines(nodes);
                drawConstraints(nodes);
            }
            else {
                self.svg.select(".points").selectAll(".point")
                    //.style("fill-opacity", null);
                    .style("fill", d => self.colorScale(d.data.gradient))
                    .style("stroke", "none");

                self.svg.select(".highlightPoints").selectAll(".point").remove();
                self.svg.select(".highlightLines").selectAll(".line").remove();

                drawConstraints([]);
            }

            function drawHighlightPoints(nodes) {
                let point = self.svg.select(".highlightPoints").selectAll(".point")
                    .data(nodes, function(d) {
                        return d.data.id;
                    });

                point.enter().append("circle")
                    .attr("class", "point")
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

                        self.dispatcher.call("select", this, d.data);
                    })
                  .merge(point)
                    .attr("cx", function(d) {
                        return self.xScale(d.depth);
                    })
                    .attr("cy", function(d) {
                        return self.yScale(d.data.distance);
                    })
                    .attr("r", function(d) {
                        return self.radiusScale(d.data.gradientMag);
                    })
                    .style("fill", function(d) {
                        return self.colorScale(d.data.gradient);
                    })
                    .style("stroke",  function(e) {
                        return (self.selectedEvent && self.selectedEvent === e.data) || (d && d.data === e.data) ?
                            "black" : "none";
                    });

                point.exit().remove();
            }

            function drawHighlightLines(nodes) {
                // d3 style
                let linkShape = d3.linkHorizontal()
                    .source(function (d) {
                        return d.parent;
                    })
                    .target(function (d) {
                        return d;
                    })
                    .x(function (d) {
                        return self.xScale(d.depth);
                    })
                    .y(function (d) {
                        return self.yScale(d.data.distance);
                    });

                let line = self.svg.select(".highlightLines").selectAll(".line")
                    .data(nodes.slice(1), function(d) {
                        return d.data.id;
                    });

                line.enter().append("path")
                    .attr("class", "line")
                    .style("fill", "none")
                    .style("pointer-events", "none")
                  .merge(line)
                    .attr("d", linkShape)
                    .style("stroke", function (d) {
                        return self.colorScale(d.data.gradient);
                    });

                line.exit().remove();
            }

            function drawConstraints(nodes) {
                // Symbol for constraints
                let symbol = d3.symbol()
                    .type(d3.symbolDiamond)
                    .size(20);

                let root = self.data.root;
                let constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

                let r = self.radiusScale.range()[0];

                let constraintNodes = root.descendants().filter(function(d) {
                    return (!self.collapsible(d) ||
                            nodes.indexOf(d) !== -1)
                            &&
                            constraints.indexOf(d.data.id) !== -1;
                });

                let constraint = self.svg.select(".constraints").selectAll(".constraint")
                    .data(constraintNodes, function (d) {
                        return d.data.id;
                    });

                constraint.enter().append("path")
                    .attr("class", "constraint")
                    .attr("d", symbol)
                    .style("pointer-events", "none")
                    .style("fill", "black")
                  .merge(constraint)
                    .attr("transform", function(d) {
                        const x = self.xScale(d.depth) + self.radiusScale(d.data.gradientMag) + 3;
                        const y = self.yScale(d.data.distance);

                        return "translate(" + x + "," + y + ")";
                    });

                constraint.exit().remove();
            }
        }
    }
})
