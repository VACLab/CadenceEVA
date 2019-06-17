"use strict"
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/query",
    "dojo/aspect"
], (declare, lang, registry, Menu, MenuItem, query, aspect) => {
    return class {
        constructor(dom_container_id) {
            let this_chart = this;

            this.chart = new d3Kit.SvgChart("#"+dom_container_id, {
                margin: {top: 0, right: 0, bottom: 0, left: 0},
                offset: {x: 0, y: 0}
            });
            this.chart.setupDispatcher(['filter']);

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
        init(init_data, horizontal_scale) {
            let or_zero = this.or_zero;

            this.data = init_data;
            this.horizontal_scale = horizontal_scale;

            this.clip_id = cadence.uidGenerator();

            // Determine order of values to display (decreasing by frequency of the value).
            this.data_order = this.data.type.domain.slice();
            this.data_order.sort(function(a,b) {
                let b_val = or_zero(init_data.stats[b]);
                let a_val = or_zero(init_data.stats[a]);
                return b_val - a_val;
            });

            // Determine height of chart based on possible values in attribute domain.
            let possible_value_count = this.data.type.domain.length;
            this.chart.fit({
                width: '100%',
                height: '' + 10 * (possible_value_count + 2) + 'px'
            }, true);
            this.render();
        }

        render() {
            let this_vis = this;
            let this_data = this.data;
            let or_zero = this.or_zero;
            let total = this.horizontal_scale

            let x = d3.scaleLinear().domain([0, 100]).range([0, this.chart.getInnerWidth()]);
            let y = d3.scaleLinear().domain([0, 100]).range([0, this.chart.getInnerHeight()]);
            let color = d3.scaleOrdinal(d3.schemeDark2).domain(this.data.type.domain);

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

            // Render the bar labels.  Start with a clipping box.
            let _clips = this.chart.rootG.selectAll('clipPath').data([1]);
            _clips.enter().append("clipPath")
                    .attr("id", this.clip_id)
                    .append("rect")
                        .attr('x', 0)
                        .attr('width', x(29))
                        .attr('y', 0)
                        .attr('height', y(100));
            _clips.select("rect")
                .attr('width', x(29))
                .attr('height', y(100));

            let _labels = this.chart.rootG.selectAll(".bar_label").data(this.data_order);
            _labels.exit().remove();
            _labels.enter().append("text")
                .attr('class', 'bar_label')
                .attr('y', function(d,i) { return 21+i*10; })
                .style("font-size", "8px")
                .style("font-weight", "normal")
                .style('fill', 'black')
                .attr('clip-path', 'url(#'+this.clip_id+')')
                .text(function(d) { return d;})
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                .merge(_labels)
                    .attr('x', function(d) { return x(0);});

            // Render the bar blocks.
            let _blocks = this.chart.rootG.selectAll(".bar_block").data(this.data_order);
            _blocks.exit().remove();
            _blocks.enter().append("rect")
                .attr('class', 'bar_block')
                .attr('y', function(d,i) { return 14+i*10; })
                .attr('x', function(d) { return x(30);})
                .attr('height', 8)
                .attr('width', function(d) {
                    let _scale = or_zero(this_data.stats[d]) / total;
                    return (x(90) - x(30)) * _scale;
                })
                .style('fill', function(d) { return "#333333"; })
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                .on("mouseover", function(d) {
                    d3.select(this).style('fill', '#2196f3')
                })
                .on("mouseout", function(d) {
                    d3.select(this).style('fill', '#333333')
                });
            _blocks
                .attr('x', function(d) { return x(30);})
                .attr('width', function(d) {
                    let _scale = or_zero(this_data.stats[d]) / total;
                    return (x(90) - x(30)) * _scale;
                });

            // Render the block value labels.
            let _vals = this.chart.rootG.selectAll(".block_value").data(this.data_order);
            _vals.exit().remove();
            _vals.enter().append("text")
                .attr('class', 'block_value')
                .attr('y', function(d,i) { return 21+i*10; })
                .attr('x', function(d) {
                    let _scale = or_zero(this_data.stats[d]) / total;
                    return x(31) + (x(90) - x(30)) * _scale;
                })
                .text(function(d) { return d;})
                .style("font-size", "8px")
                .style("font-weight", "normal")
                .style('fill', '#333333')
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                .text(function(d) {
                    let frac = or_zero(this_data.stats[d])/total;
                    return "" + (frac*100).toFixed(0) + "%";
                });
            _vals
                .attr('x', function(d) {
                    let _scale = or_zero(this_data.stats[d]) / total;
                    return x(31) + (x(90) - x(30)) * _scale;
                });



        }

        or_zero(value) {
            if (value) {
                return value;
            }
            else {
                return 0;
            }
        }
    }

})
