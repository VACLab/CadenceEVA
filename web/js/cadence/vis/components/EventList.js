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
    "dijit/Tooltip",
    "dojo/aspect",
    "vaclab/VaclabVis"
], (declare, lang, dom, domStyle, dojoOn, registry, Menu, MenuItem, Tooltip, aspect, VaclabVis) => {
    return class extends VaclabVis {

        constructor(dom_container_id, showAxis) {
            super(dom_container_id, ["select"]);

            let self = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Selection
            this.selectedEvent = null;

            // Threshold
            this.gradientThreshold = 1;

            // Options
            this.collapseType = "gradientInOut";

            this.barWidth = 50;
            this.barHeight = 10;

            // Create the table element
            this.table = d3.select("#" + this.containerID).append("table")
                .style("font-size", "xx-small")
                .style("border-collapse", "separate")
                .style("border-spacing", "0px");

            this.table.append("col").style("width", "auto");
            this.table.append("col").style("width", "auto");
            this.table.append("col").style("width", this.barWidth);
            this.table.append("col").style("width", 10);
        }

        resize(width, height) {
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

            this.render();

            if (event) {
                // Scroll to event
                let selectedRow = null;
                this.table.selectAll("tr").each(function(d) {
                    if (d.id === event.id) {
                        selectedRow = this;
                    }
                });

                if (selectedRow && !isInViewport(selectedRow)) {
                    selectedRow.scrollIntoView({behavior: "auto", block: "center"});
                }

                function isInViewport(node) {
                    let bb = node.getBoundingClientRect();

                    return (
                        bb.top >= 0 &&
                        bb.left >= 0 &&
                        bb.bottom <= window.innerHeight &&
                        bb.right <= window.innerWidth
                    );
                }
            }
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

        // The render function, which should update all elements of this visualization.
        render() {
            let self = this;

            function collapsible(node) {
                switch (self.collapseType) {
                    case "gradientIn":
                        return !(node.data.gradient >= self.gradientThreshold || node.data === self.selectedEvent);

                    case "gradientMagIn":
                        return !(node.data.gradientMag >= self.gradientThreshold || node.data === self.selectedEvent);

                    case "gradientInOut":
                        return !(node.data.gradient >= self.gradientThreshold ||
                            (node.children && node.children.reduce((p, c) => p || c.data.gradient <= -self.gradientThreshold, false)) ||
                            node.data === self.selectedEvent);
                }
            }

            let events = this.data.root.descendants()
                .filter(d => !collapsible(d))
                .map(d => d.data)
                .sort(function(a, b) {
                    return d3.descending(a.distance, b.distance);
                });

            let range = this.data.range;
            let constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

            // TODO: Switch to a d3 scheme chromatic color map?
            // TODO: Share color map across visualizations.
            let colorScale = d3.scaleLinear()
                .domain([-range.maxNonConstraintDistance, 0, range.maxNonConstraintDistance])
                .range(["#2166ac", "#999", "#b2182b"])
                .clamp(true);;

            let widthScale = d3.scaleLinear()
                .domain([0, range.maxEventDistance])
                .range([0, this.barWidth]);

            let borderWidth = 1;

            let numberFormat = d3.format(".3f");

            // Symbol for constraints
            let symbol = d3.symbol()
                .type(d3.symbolDiamond)
                .size(20);

            // Bind event data
            let row = self.table.selectAll("tr")
                .data(events);

            // Enter
            let rowEnter = row.enter().append("tr")
                .on("mouseover", function(d) {
                    const constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

                    const text =
                        "<div style='font-size:x-small'>" +
                            "<div>" + d.code + ": " + d.label + "</div>" +
                            (constraints.indexOf(d.id) !== -1 ? "<div>♦ : Constraint</div>" : "") +
                            "<hr>" +
                            "<div>Distance: " + numberFormat(d.distance) + "</div>" +
                            "<div>Gradient: " + numberFormat(d.gradient) + "</div>" +
                        "</div>";

                    Tooltip.show(text, this);
                    self.highlight(d);
                })
                .on("mouseout", function() {
                    Tooltip.hide(this);
                    self.highlight();
                })
                .on("click", function(d) {
                    d3.event.stopPropagation();

                    self.dispatcher.call("select", this, d);
                });

            rowEnter.append("td")
                .attr("class", "codeColumn")
                .style("border-width", borderWidth)
                .style("border-top-style", "solid")
                .style("border-bottom-style", "solid")
                .style("border-left-style", "solid");

            rowEnter.append("td")
                .attr("class", "labelColumn")
                .style("border-width", borderWidth)
                .style("border-top-style", "solid")
                .style("border-bottom-style", "solid");

            rowEnter.append("td")
                .attr("class", "barColumn")
                .style("border-width", borderWidth)
                .style("border-top-style", "solid")
                .style("border-bottom-style", "solid")
              .append("div")
                .style("height", this.barHeight);

            rowEnter.append("td")
                .attr("class", "constraintColumn")
                .style("border-width", borderWidth)
                .style("border-top-style", "solid")
                .style("border-bottom-style", "solid")
                .style("border-right-style", "solid");

            // Enter + update
            let rowUpdate = rowEnter.merge(row);

            rowUpdate.select(".codeColumn")
                .text(function(d) {
                    return d.code;
                });

            rowUpdate.select(".labelColumn")
                .text(function(d) {
                    return d.label;
                });

            rowUpdate.select(".barColumn").select("div")
                .style("width", function(d) {
                    return widthScale(d.distance)
                })
                /*
                .style("background-color", function(d) {
                    return colorScale(d.gradient);
                });
                */
                .style("background-color", "#999")

            rowUpdate.select(".constraintColumn")
                .text(function(d) {
                    const constrained = constraints.indexOf(d.id) !== -1;

                    return constrained ? "♦" : "";
                });

            // Exit
            row.exit().remove();

            self.highlight(null);
        }

        highlight(d) {
            let self = this;

            this.table.selectAll("tr").selectAll("td")
                .style("border-color", function(e) {
                    return doHighlight(e) ? "rgba(0, 0, 0, 1)" : "rgba(0, 0, 0, 0)";
                });

            function doHighlight(e) {
                return e === d || e === self.selectedEvent;
            }
        }
    }
})
