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
    "vaclab/VaclabVis",
    "cadence/vis/components/CohortNode"
], (declare, lang, dom, domStyle, dojoOn, registry, Menu, MenuItem, aspect, VaclabVis, CohortNode) => {
    return class extends VaclabVis {

        constructor(dom_container_id) {
            super(dom_container_id, ["baseline", "focus"]);

            // Store the container ID.
            this.containerID = dom_container_id;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);

            //TODO: Hard coded to referencce?
            this.width = 68;
            this.height =54;

            // Cohort node function
            this.cohortNode = CohortNode();

            // Margin calculation based on node size
            let m = this.cohortNode.radius() * 1.5;

            // TODO: Move margin and inner width/height to VaclabVis?
            let margin = { top: m, left: m, bottom: m, right: m };

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left+ "," + margin.top + ")");

            g.append("g").attr("class", "glyph").attr("transform", "translate(10,0)");

            // Apply tooltips
            this.cohortHighlightTip = d3.tip()
                .attr("class", "d3-tip")
                .offset(function(d) {
                    return d.baseline ? [-6, 0] : [-18, -6]
                })
                .direction("n")
                .html(function(d) {
                    return d.baseline ? "<div><strong>BASELINE</strong></div>" :
                        "<div><strong>FOCUS</strong></div>";
                });

            this.svg.call(this.cohortHighlightTip);
        }

        init(init_data) {
            // Store a reference to the data.
            this.data=init_data;

            this.render();
        }

        updateIcon(_baseline, _currentCohort){
            this.baseline = _baseline;
            this.data.baseline = _currentCohort.baseline;
            this.data.focus = _currentCohort.focus;

            this.render();
        }

        update(update_data) {
            // Store a reference to the data
            this.data = update_data;

            this.render();
        }

        //update distances matrix for node icon
        updateDistances(new_distances){
            this.data.distances=new_distances;
        }

        resize(){
            this.render();
        }

        // The render function, which should update all elements of this visualization.
        render() {

            // Save reference to this for use in inner functions
            let self = this;
            let _data = this.data;
            let maxSize = this.data.maxSize;

            // Maximum distance
            let maxDistance = d3.max(d3.values(self.data.distances), function(d) {
                return d3.max(d3.values(d));
            });

            // Set baseline
            if(this.baseline == null){
                this.baseline=_data;
            }

            // Draw
            drawNode();

            function drawNode() {
                // Update cohort node function
                self.cohortNode
                    .distances(self.data.distances)
                    .maxSize(maxSize)
                    .baseline(self.baseline);

                self.svg.select(".glyph")
                    .datum(_data)
                    .call(self.cohortNode);


                // Cohort highlight tooltip
                self.svg.select(".glyph").selectAll(".highlight")
                    .on("mouseover", function(d) {
                        d3.event.stopPropagation();
                        self.cohortHighlightTip.show(d);
                    })
                    .on("mouseout", function(d) {
                        d3.event.stopPropagation();
                        self.cohortHighlightTip.hide();
                    });

            }
        }
    }
});
