"use strict";
define([
    "dijit/Menu",
    "dijit/MenuItem",
], (Menu, MenuItem) => {
    return class {
        constructor(dom_container_id) {
            let this_chart = this;

            this.chart = new d3Kit.SvgChart("#"+dom_container_id, {
                margin: {top: 0, right: 0, bottom: 0, left: 0},
                offset: {x: 0, y: 0}
            });
            this.chart.setupDispatcher(['filter']);

            // Size the chart based on possible values in attribute domain.
            this.chart.fit({
                width: '75%',
                height: '54px'
            }, true);

            this.chart.on('resize', function (info) {
                this_chart.render();
            });

            // Give the chart group an ID, so we can anchor the context menu to it.
            this.g_uid = cadence.uidGenerator();
            this.chart.rootG.attr("id", this.g_uid);

            this.contextMenu = new Menu({
                targetNodeIds: [this.g_uid],
                selector: '*'
            });
            this.filterMenuItem = new MenuItem({
                label: "Filter...",
                onClick: function(e){
                    var node = this.getParent().currentTarget;
                    var args = { type: this_chart.data.type, val: node.__data__};

                    this_chart.chart.dispatcher.call("filter", this_chart, args);
                }
            });
            this.contextMenu.addChild(this.filterMenuItem);
        }

        on(event_name, event_handler) {
            this.chart.dispatcher.on(event_name, event_handler);
        }

        // This is for steps that have to be done after the initial construction, such as the first resize.  Note that
        // this resize should trigger a render automatically.
        init(init_data) {
            this.data = init_data;

            // Get sorted list of integer values, used to find min and max.
            this.intValues = Object.keys(this.data.stats).map(x => parseInt(x));
            this.intValues.sort(function(a,b) {return a-b;});

            // Also get the maximum frequency value (to normalize the chart height scale).
            this.maxfreq = Object.values(this.data.stats).reduce(function(a,b) {
                return Math.max(a,b);
            });

            // Size the chart based on possible values in attribute domain.
            this.chart.fit({
                width: '75%',
                height: '54px'
            }, true);

            this.render();
        }

        render() {
            let this_vis = this;
            let this_data = this.data;
            let extremes = [Math.min(0,this.intValues[0]), Math.max(100,this.intValues[this.intValues.length-1]+1)];
            let x = d3.scaleLinear().domain(extremes)
                .range([0, this.chart.getInnerWidth()]);
            let y = d3.scaleLinear().domain([0,this.maxfreq])
                .range([40, 16]);
                //.range([this.chart.getInnerHeight()-10, 14]);

            // Render the label.
            let _title = this.chart.rootG.selectAll(".chart_label").data([this.data.type.label]);
            _title.exit().remove();
            _title.enter().append('text')
                .attr('class', 'chart_label')
                .attr('x', 0)
                .attr('y', 12)
                .style("font-size", "12px")
                .style("font-weight", "normal")
                .style('fill', 'black')
                .text(this.data.type.label);

            // Render the actual data values, one rectangle for each integer value.
            let _bars = this.chart.rootG.selectAll(".chart_bars").data(this.intValues);
            _bars.exit().remove();
            _bars.enter().append("rect")
                .attr('class', 'chart_bars')
                .style("fill", "#333333")
                .style("stroke-width", "0px")
                .on("mouseover", function(d) {
                    d3.select(this).style('fill', '#2196f3')
                    let xscale = d3.scaleLinear().domain(extremes)
                           .range([0, this_vis.chart.getInnerWidth()]);
                    this_vis.chart.rootG.append("text")
                        .attr("id", "highlight_label")
                        .style("font-size", "8px")
                        .style("font-weight", "bold")
                        .style("text-anchor", "middle")
                        .style("fill", "#2196f3")
                        .attr('x', xscale(d) )
                        .attr('y', y(0)+9)
                        .text(d);
                })
                .on("mouseout", function(d) {
                    d3.select(this).style('fill', '#333333')
                    this_vis.chart.rootG.selectAll("#highlight_label").remove();
                })
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                .merge(_bars)
                    .attr('x', function(d) { return x(d); })
                    .attr('width', function(d) {
                        return x(d+1)-x(d);
                    })
                    .attr('y', function(d) { return y(this_data.stats[d]); })
                    .attr('height', function(d) {
                        return y(0)-y(this_data.stats[d]);
                    });

            // Render the axis.
            let _axis = this.chart.rootG.selectAll(".chart_axis").data([this.data.type.label]);
            _axis.exit().remove();
            _axis.enter().append("line")
                .style("stroke", "black")
                .style("stroke-width", "1px")
                .merge(_axis)
                    .attr('x1', function(d) { return x(extremes[0]); })
                    .attr('x2', function(d) { return x(extremes[1]); })
                    .attr('y1', y(0))
                    .attr('y2', y(0));

            // Render the min/max axis labels.
            let axis_labels = this.chart.rootG.selectAll(".axis_label").data(extremes);
            axis_labels.exit().remove();
            axis_labels.enter().append('text')
                .attr('class', 'axis_label')
                .style("font-size", "8px")
                .style("font-weight", "normal")
                .style("text-anchor", function(d,i) {return (i ? "end" : "start" )})
                .style('fill', 'black')
                .text(function(d,i) { return (i ? d-1 : d);})
                .merge(axis_labels)
                    .attr('x', function(d,i) { return x(d); })
                    .attr('y', y(0)+9);
        }
    }
})
