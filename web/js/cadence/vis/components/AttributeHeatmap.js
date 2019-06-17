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

            // Appearance
            this.barHeight = 12;
            this.highlightColor = "black";

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);

            // Margins
            let margin = { top: 1, left: 1, bottom: 1, right: 1 };
            this.innerWidth = function() { return this.width - margin.left - margin.right; }.bind(this);
            this.innerHeight = function() { return Math.max(0, this.height - margin.top - margin.bottom); }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .on("click", function() {
                    self.dispatcher.call("select", this, null);
                });

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Create groups for rendering layers
            g.append("g").attr("class", "attributes");

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
                .domain([0, range.maxNonConstraintDistance])
                .range(["#999", "#b2182b"])
                .clamp(true);

            // Band scale for attributes
            let bandScale = d3.scaleBand()
                .domain(d3.range(0, attributes.length))
                .range([0, this.innerWidth()])
                .paddingInner(15 / this.innerWidth());

            // Symbol for constraints
            let symbol = d3.symbol()
                .type(d3.symbolDiamond)
                .size(20);

            // Bind attribute data
            let attribute = this.svg.select(".attributes").selectAll(".attribute")
                .data(attributes);

            // Enter
            let attributeEnter = attribute.enter().append("g")
                .attr("class", "attribute");

            attributeEnter.append("rect")
                .attr("rx", 3)
                .attr("ry", 3)
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

            attributeEnter.append("text")
                .style("text-anchor", "middle");

            // Enter + update
            attributeEnter.merge(attribute).each(function(d, i) {
                let g = d3.select(this);

                const w = bandScale.bandwidth();
                const h = self.barHeight;
                const x = bandScale(i);
                const y = self.innerHeight() - h;

                g.select("rect")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("width", w)
                    .attr("height", h)
                    // TODO: Using distance with gradient color scale
                    .style("fill", colorScale(d.distance))
                    .style("stroke", "#999");

                g.select("text")
                    .text(d => d.label)
                    .attr("x", x + w / 2)
                    .attr("y", y)
                    .attr("dy", "-.3em");


                // Update constraint symbol
                let constrained = constraints.indexOf(d.code) !== -1;

                let constraint = g.selectAll(".constraint")
                    .data(constrained ? [d] : []);

                constraint.enter().append("path")
                    .attr("class", "constraint")
                    .attr("d", symbol)
                    .style("pointer-events", "none")
                    .style("fill", "black")
                  .merge(constraint)
                    .attr("transform", "translate(" + (x + w / 2) + "," + (y + h / 2) + ")");

                constraint.exit().remove();
            });

            // Exit
            attribute.exit().remove();

            self.highlight();
        }

        highlight(d) {
            let self = this;

            this.svg.select(".attributes").selectAll(".attribute").select("rect")
                .style("stroke", function(d) {
                    return doHighlight(d) ? self.highlightColor : "#999";
                })
                .style("stroke-width", function(d) {
                    return doHighlight(d) ? 3 : 1;
                });

            function doHighlight(e) {
                return e === d || e === self.selectedAttribute;
            }
        }
    }
})
