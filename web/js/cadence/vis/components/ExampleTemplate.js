"use strict"
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/aspect"
], (declare, lang, registry, Menu, MenuItem, aspect) => {
    return class {
        constructor(dom_container_id) {
            var thisChart = this;

            this.dispatcher = d3.dispatch("filter");

            this.chart = new d3Kit.SvgChart(dom_container_id, {
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                offset: { x: 0, y: 0 }
            });
            this.chart.setupDispatcher(['eventOne', 'eventTwo']);

            // Set up auto-refitting
            this.chart.fit({
                mode: 'basic',
                width: '100%',
                height: '200px'
            }, true);
            this.chart.on('resize', function(info) {
                thisChart.render();
            });
        }

        // This is for steps that have to be done after the initial construction, such as the first resize.  Note that
        // this resize should trigger a render automatically.
        init(init_data) {
            this.data = init_data;

            this.chart.fit({
                width: '100%',
                height: '200px'
            });
            this.render();
        }

        render() {
            var this_chart = this.chart;

            var x = d3.scaleLinear().domain([0,100]).range([0, this.chart.getInnerWidth()]);
            var y = d3.scaleLinear().domain([0,100]).range([0, this.chart.getInnerHeight()]);

            // Render the attributes.
            this.chart.rootG.append('text')
                .attr('x', 3)
                .attr('y', 3)
                .style("font-size", "12px")
                .style('fill', 'black')
                .text("Attributes:" + this.data.id + "!");

            this.chart.rootG.append('rect')
                .attr('x', x(0))
                .attr('y', y(0))
                .attr('width', x(100)-x(0))
                .attr('height', y(100)-y(0))
                .attr('stroke', 'red')
                .attr('stroke-width', 5);

            this.chart.rootG.append('text')
                .attr('x', x(0))
                .attr('y', y(100))
                .style("font-size", "34px")
                .style('fill', 'purple')
                .text("HELLO COHORT " + this.data.id + "!");
        }
    }
})
