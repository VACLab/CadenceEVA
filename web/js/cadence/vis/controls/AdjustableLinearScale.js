"use strict";
define([
    "vaclab/VaclabVis",
    "cadence/vis/VisualizationColors"
], (VaclabVis, VisualizationColors) => {
    return class extends VaclabVis {

        constructor(dom_container_id, width, height, overlapOffset, rangeMin = 0, rangeMax = 1, startMin = 0, startMax = 1,
                    unit = '', precision = '', colors = ["green", "#bbbb00", "red"], range = true) {
            // Call the superclass constructor, initializing to broadcast a single event: update for when
            // the scale has been updated.
            super(dom_container_id, ["update"]);

            let thisvis = this;

            // Constants
            this.colorLib = new VisualizationColors();
            this.handleColor = this.colorLib.handleColor;
            this.width = width;
            this.height = height;
            this.unit = unit;
            this.precision = d3.format(precision);
            this.offset = overlapOffset;

            // Set handle size based on size of the SVG
            this.handleWidth = width*0.08;
            this.handleHeight = height*0.30;

            //Map handle locations to set range of linear scale
            this.rangeMin = rangeMin;
            this.rangeMax = rangeMax;
            this.handleToRange = d3.scaleLinear().domain([thisvis.handleWidth*2, (thisvis.width-thisvis.handleWidth*2)]).range([thisvis.rangeMin, thisvis.rangeMax]);

            //Map linear scale range to start and stop of gradient in the svg
            this.rangeToHandle = d3.scaleLinear().domain([thisvis.rangeMin, thisvis.rangeMax]).range([thisvis.handleWidth*2, (thisvis.width-thisvis.handleWidth*2)]);
            this.startMin = this.rangeToHandle(startMin);
            this.startMax = this.rangeToHandle(startMax);

            this.minHandlePoints = this.startMin*0.75 + ",0, " + this.startMin*1.25 + ",0, " + this.startMin + "," + this.handleHeight;
            this.maxHandlePoints = (this.startMax - this.handleWidth*0.5)  + ",0, " + (this.startMax + this.handleWidth*0.5) + ",0, " + this.startMax + "," + this.handleHeight;

            // Map handle locations to range of 0 to 1 for calculations
            this.sliderScale = d3.scaleLinear().domain([thisvis.handleWidth*2, (thisvis.width-thisvis.handleWidth*2)]).range([0,1]);

            // Store the container ID.
            this.containerID = dom_container_id;

            // Store the initial values of the sliders.  We store these
            // in pixel coordinates for ease of calculations with mouse
            // coordinates.  Reporting via the update event will be done
            // in percentages.
            this.min = this.startMin;
            this.max = this.startMax;

            // Create the SVG element with the requested size.
            this.svg = d3.select("#"+this.containerID).append("svg")
                .style("height", this.height)
                .style("width", this.width);

            // Create linear gradient
            const gradient = this.svg.append("defs")
                .append("linearGradient")
                .attr("id", "gradient_"+dom_container_id)
                .attr("x1", this.sliderScale(this.startMin))
                .attr("y1", "0%")
                .attr("x2", this.sliderScale(this.startMax))
                .attr("y2", "0%")
                .attr("spreadMethod", "pad");

            gradient.selectAll("stop")
                .data(colors)
                .enter().append("stop")
                .attr("offset", function(d, i) { return (i / (colors.length - 1) * 100) + "%"; })
                .attr("stop-color", function(d) { return d; })
                .attr("stop-opacity", 1);

            //Create rect element
            this.svg.append("rect")
                .attr("id", this.containerID+"_gradient")
                .attr("x",this.handleWidth*2)
                .attr("y", height*0.30)
                .attr("width",width-this.handleWidth*4)
                .attr("height",height*0.30)
                .style("fill", "url(#gradient_"+dom_container_id+")");

            if (range) {
                this.svg.append("line")
                    .attr("id", this.containerID + "_min_line")
                    .style("stroke", "black")
                    .style("stroke-width", 1)
                    .attr("x1", this.startMin)
                    .attr("y1", (height * 0.30) - (1.2 * this.handleHeight))
                    .attr("x2", this.startMin)
                    .attr("y2", height * 0.60);
            }

            this.svg.append("line")
                .attr("id", this.containerID+"_max_line")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .attr("x1", this.startMax)
                .attr("y1", (height*0.30)-(1.2*this.handleHeight))
                .attr("x2", this.startMax)
                .attr("y2", height*0.60);

            if (range) {
                this.svg.append("polygon")
                    .attr("id", this.containerID + "_min_slider")
                    .style("fill", this.handleColor)
                    .style("stroke", "black")
                    .style("stroke-width", 1)
                    .attr("x", this.startMin)
                    .attr("y", 0)
                    .attr("points", this.minHandlePoints)
                    .call(d3.drag()
                        .on("start", function (d) {
                            d3.select(this)
                                .style("stroke", "black")
                                .style("stroke-width", 1.5)
                        })
                        .on("drag", function (d) {
                            // Calculate the new x position of the slider.  We use
                            // Math.max to make sure the value does not go below zero.
                            thisvis.min = Math.max(thisvis.handleWidth*2, thisvis.min + d3.event.dx);

                            // We also have to make sure that the slider doesn't exceed the max slider position.
                            thisvis.min = Math.min(thisvis.min, thisvis.max - thisvis.handleWidth);

                            // Update the slider and the stored value for the slider
                            d3.select(this).attr("x", thisvis.min);
                            d3.select(this).attr("points", thisvis.min - thisvis.handleWidth / 2 + ",0, " +
                                (thisvis.min + thisvis.handleWidth / 2) + ",0, " + thisvis.min + "," + thisvis.handleHeight);
                            d3.select("#" + thisvis.containerID + "_min_line").attr("x1", thisvis.min);
                            d3.select("#" + thisvis.containerID + "_min_line").attr("x2", thisvis.min);
                            updateGradient(thisvis.sliderScale(thisvis.min), thisvis.sliderScale(thisvis.max));

                            updateMinLabel(thisvis.min, thisvis.max);
                            d3.select("#" + thisvis.containerID + "_min_label").text(thisvis.precision(thisvis.handleToRange(thisvis.min)) + thisvis.unit);

                            // Announce the updated values to all listeners.
                            thisvis.dispatcher.call("update", thisvis,
                                thisvis.sliderScale(thisvis.min),
                                thisvis.sliderScale(thisvis.max)
                            );
                        })
                        .on("end", function (d) {
                            d3.select(this)
                                .style("stroke-width", 1);
                        })
                    );
            }

            this.svg.append("polygon")
                .attr("id", this.containerID+"_max_slider")
                .style("fill", this.handleColor)
                .style("stroke", "black")
                .style("stroke-width", 1)
                .attr("x", this.startMax)
                .attr("y", 0)
                .attr("points", this.maxHandlePoints)
                .call(d3.drag()
                    .on("start",function (d) {
                        d3.select(this)
                            .style("stroke","black")
                            .style("stroke-width",1.5);
                    })
                    .on("drag", function(d) {
                        // Calculate the new x position of the slider.  We use
                        // Math.min to make sure the value does not go over the
                        // max possible value.
                        thisvis.max = Math.min(thisvis.max + d3.event.dx, thisvis.width - thisvis.handleWidth*2);

                        // We also have to make sure that the slider doesn't go below the min slider position.
                        thisvis.max = Math.max(thisvis.min + thisvis.handleWidth, thisvis.max);

                        // Update the slider and the stored value for the slider
                        d3.select(this).attr("x", thisvis.max);
                        d3.select(this).attr("points", thisvis.max-thisvis.handleWidth/2+ ",0, " +
                            (thisvis.max+thisvis.handleWidth/2)+",0, "+thisvis.max+","+ thisvis.handleHeight);
                        d3.select("#"+thisvis.containerID+"_max_line").attr("x1", thisvis.max);
                        d3.select("#"+thisvis.containerID+"_max_line").attr("x2", thisvis.max);
                        updateGradient(thisvis.sliderScale(thisvis.min), thisvis.sliderScale(thisvis.max));

                        updateMaxLabel(thisvis.min, thisvis.max);
                        d3.select("#"+thisvis.containerID+"_max_label").text(thisvis.precision(thisvis.handleToRange(thisvis.max)) + thisvis.unit);

                        // Announce the updated values to all listeners.
                        thisvis.dispatcher.call("update", thisvis,
                            thisvis.sliderScale(thisvis.min),
                            thisvis.sliderScale(thisvis.max)
                        );
                    })
                    .on("end",function (d) {
                        d3.select(this)
                            .style("stroke-width",1);
                    })
                );

            if (range) {
                this.svg.append("text")
                    .attr("id", this.containerID + "_min_label")
                    .attr("x", this.startMin - this.handleWidth)
                    .attr("y", height)
                    .attr("font-size", 8)
                    .text(startMin + unit);
            }

            this.svg.append("text")
                .attr("id", this.containerID+"_max_label")
                .attr("x", this.startMax-this.handleWidth*0.8)
                .attr("y", height)
                .attr("font-size", 8)
                .text(startMax + unit);

            function updateGradient(_value1, _value2) {
                d3.select("#gradient_"+dom_container_id).attr("x1", _value1);
                d3.select("#gradient_"+dom_container_id).attr("x2", _value2);
            }

            function updateMinLabel(min, max) {
                // Make sure that the slider doesn't exceed the max slider position.
                min = Math.min(min, max - thisvis.handleWidth - thisvis.offset);
                d3.select("#"+dom_container_id+"_min_label").attr("x", min-thisvis.handleWidth);
            }

            function updateMaxLabel(min, max) {
                //Make sure the label does not leave the svg area
                max = Math.min(max, max-thisvis.handleWidth);
                // We also have to make sure that the slider doesn't exceed the min slider position.
                max = Math.max(min + thisvis.offset, max);
                d3.select("#"+dom_container_id+"_max_label").attr("x", max);
            }
        }

        resize(width,height) {
            // Do nothing. Resize not supported.
        }
    }
});
