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

        constructor(dom_container_id) {
            super(dom_container_id, ["select"]);

            let self = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Selection
            this.selectedAttribute = null;

            this.barHeight = 10;

            // Create the table element
            this.table = d3.select("#" + this.containerID).append("table")
                .style("width", "100%")
                .style("font-size", "xx-small")
                .style("border-collapse", "separate")
                .style("border-spacing", "0px");

            this.table.append("col").style("width", "auto");
            this.table.append("col").style("width", "100%")
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

            // TODO: Switch to a d3 scheme chromatic color map?
            // TODO: Share color map across visualizations.
            let colorScale = d3.scaleLinear()
                .domain([-range.maxNonConstraintDistance, 0, range.maxNonConstraintDistance])
                .range(["#2166ac", "#999", "#b2182b"])
                .clamp(true);

            let widthScale = d3.scaleLinear()
                .domain([0, range.maxAttributeDistance])
                .range([0, 100]);

            let borderWidth = 1;

            let numberFormat = d3.format(".3f");

            // Bind attribute data
            let row = self.table.selectAll("tr")
                .data(attributes);

            // Enter
            let rowEnter = row.enter().append("tr")
                .on("mouseover", function(d) {
                    const constraints = self.data.constraints.filter(d => d.code).map(d => d.code);

                    const text =
                        "<div style='font-size:x-small'>" +
                            "<div>" + d.label + "</div>" +
                            (constraints.indexOf(d.code) !== -1 ? "<div>♦ : Constraint</div>" : "") +
                            "<hr>" +
                            "<div>Distance: " + numberFormat(d.distance) + "</div>" +
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
                .attr("class", "labelColumn")
                .style("border-width", borderWidth)
                .style("border-top-style", "solid")
                .style("border-bottom-style", "solid")
                .style("border-left-style", "solid")
                .text(function(d) {
                    return d.label;
                });

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

            rowUpdate.select(".labelColumn");

            rowUpdate.select(".barColumn").select("div")
                .style("width", function(d) {
                    return widthScale(d.distance) + "%";
                })
                /*
                .style("background-color", function(d) {
                    return colorScale(d.distance);
                });
                */
                .style("background-color", "#999");

            rowUpdate.select(".constraintColumn")
                .text(function(d) {
                    const constrained = constraints.indexOf(d.code) !== -1;

                    return constrained ? "♦" : "";
                });

            // Exit
            row.exit().remove();

            self.highlight(null);
        }

        highlight(d) {
            let self = this;

            this.table.selectAll("td")
                .style("border-color", function(e) {
                    return doHighlight(e) ? "rgba(0, 0, 0, 1)" : "rgba(0, 0, 0, 0)";
                });

            function doHighlight(e) {
                return e === d || e === self.selectedAttribute;
            }
        }
    }
})
