

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
            super(dom_container_id, ["select", "filter", "milestone"]);

            let thisvis = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);
            this.margin = 12;
            this.margin_left = 45;
            this.margin_top = 10;

            // Create the SVG element with the initial size.
            this.svg = d3.select("#"+this.containerID).append("svg")
                .style("height", this.height)
                .style("width", this.width);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height;

            // Update the SVG element
            this.svg
                .style("height", this.height)
                .style("width", this.width);

            // Trigger a re-render
            this.render();
        }

        init(init_data) {
            // Store a reference to the stats data.
            this.data = init_data;

            this.svg.append("text")
                .attr('class', 'titletext')
                .attr('x', 0)
                .attr('y', this.margin_top)
                .style('fill', 'black')
                .style('text-anchor', 'left')
                .text("Kaplan-Meier Plot");

            // Add axes for kaplan-meier plot.  Start with new scales.
            // x axis is for time.
            this.kmX = d3.scaleLinear().domain([0, this.data.outcomes[this.data.outcomes.length-1].time]).range([0, this.width-this.margin-this.margin_left]);
            // y axis is for percentage survival.
            this.kmY = d3.scaleLinear().domain([0, 1]).range([this.height-3*this.margin,this.margin+this.margin_top]);

            this.svg.append("g")
                .attr("class","axis")
                .attr("transform", "translate("+this.margin_left+","+(this.height-3*this.margin)+")")
                .call(d3.axisBottom(this.kmX).ticks(3));

            this.svg.append("g")
                .attr("class","axis")
                .attr("transform", "translate("+this.margin_left+","+(this.height-3*this.margin-(this.height-this.width-3*this.margin_top-3*this.margin))+")")
                .call(d3.axisTop(this.kmX).ticks(0));

            this.svg.append("g")
                .attr("id","kmyaxis")
                .attr("class","axis")
                .attr("transform", "translate("+this.margin_left+","+
                    (this.height-3*this.margin_top - (this.height-3*this.margin_top)) + ")")
                .call(d3.axisLeft(this.kmY).ticks(3));

            // And axis labels.
            this.svg.append("text")
                .attr('class', 'axistext')
                .attr('x', this.margin_left + (this.width-this.margin-this.margin_left)/2.0)
                .attr('y', this.height-0.5*this.margin)
                .style('fill', 'black')
                .style('text-anchor', 'middle')
                .text("Days Until Outcome");

            this.svg.append("text")
                .attr('class', 'axistext')
                .attr('x', 0)
                .attr('y', 0)
                .style('text-anchor', 'middle')
                .attr("transform", "translate(2,"+(
                    this.height-3*this.margin_top - 0.5*(this.height-3*this.margin_top)
                )+") rotate(90,0,0)")
                .style('fill', 'black')
                .text("Percentage");

            this.render();
        }

        update(new_data) {
            // Store a reference to the data.
            this.data = new_data;

            this.render();
        }

        render() {
            let thisvis = this;
            var stats_data = this.data;
            
            // Make an outcomes array that is dense with all dates.
            let outcomes_array = [];
            outcomes_array.push({time: stats_data.outcomes[0].time, count: stats_data.outcomes[0].count});
            let last_time = stats_data.outcomes[0].time;
            let last_count = stats_data.outcomes[0].count;
            for (let i=0; i<stats_data.outcomes.length; i++) {
                // Get the next entry in the stats data object.
                let next_entry = stats_data.outcomes[i];

                // Fill the outcomes array until the next_entry time.
                for (let t=last_time+1; t<next_entry.time; t++)  {
                    outcomes_array.push({time: t, count: last_count});
                }

                // Add the new data.
                outcomes_array.push({time: stats_data.outcomes[i].time, count: stats_data.outcomes[i].count});

                // Update the "last" values.
                last_time = stats_data.outcomes[i].time;
                last_count = stats_data.outcomes[i].count;
            }
            // Extend the chart to the end, if needed...
            let max_day =thisvis.kmX.domain()[1];
            if (last_time < max_day) {
                outcomes_array.push({time: max_day, count: last_count});
            }

            // Now render the area.
            let area = d3.area()
                .x0(function(d) { return thisvis.kmX(d.time); })
                .x1(function(d) { return thisvis.kmX(d.time); })
                .y0(function(d) { return thisvis.kmY(1-d.count/stats_data.size); })
                .y1(function(d) { return thisvis.kmY(0);});

            let kmaxis = this.svg.select("#kmyaxis").selectAll("#kmarea").data([outcomes_array]);
            kmaxis.enter().insert("path",":first-child")
                .attr("id", "kmarea")
                .attr("fill", "#dddddd")
                .attr("stroke-width", 0)
                .attr("d", area);

            kmaxis
                .transition().duration(800)
                .attrTween('d', function (d) {
                    var previous = d3.select(this).attr('d');
                    var current = area(d);
                    return d3.interpolatePath(previous, current);
                });

            // Finally, a line.
            let line = d3.line()
                .x(function(d) { return thisvis.kmX(d.time); })
                .y(function(d) { return thisvis.kmY(1-d.count/stats_data.size); });

            kmaxis = this.svg.select("#kmyaxis").selectAll("#kmline").data([outcomes_array]);
            kmaxis.enter().append("path")
                .attr("id", "kmline")
                .attr("stroke", "black")
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 1.5)
                .attr("d", line);

            kmaxis
                .transition().duration(800)
                .attrTween('d', function (d) {
                    var previous = d3.select(this).attr('d');
                    var current = line(d);
                    return d3.interpolatePath(previous, current);
                });
        }
    }
});
