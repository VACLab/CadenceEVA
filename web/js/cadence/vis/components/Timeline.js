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

        constructor(dom_container_id, startMin, startMax) {
            super(dom_container_id, ["select", "filter"]);
            let thisvis = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);

            // Init the color map range.
            // this.COLOR_MAP_MIN_LIMIT = 0.00;
            // this.COLOR_MAP_MAX_LIMIT = 1.00;
            this.color_map_min = startMin;
            this.color_map_max = startMax;

            // Create the SVG element with the initial size.
            this.svg = d3.select("#"+this.containerID).append("svg")
                .style("height", this.height)
                .style("width", this.width);

            // Set default layout params
            this.nodewidth = 20;

            // Init the selection state to null.
            this.selectedelem = {type: null, id: null};

            // Define the tool tip.
            this.tool_tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function(d) {
                    let _html = "<div style='width:150px;'><table>";

                    if (d.constraint !== undefined) {
                        _html += "<tr><th>Event:</th><td>" + d.constraint.type.label + "  (" + d.constraint.type.cat + "-" + d.constraint.type.code + ")</td></tr>";
                    }
                    else if (d.type !== undefined) {
                        if (d.type == "START_OF_TIMELINE") {
                            _html += "<tr><th>Event:</th><td>Start of " + d.duration + " day time window.</td></tr>";
                        }
                        else if (d.type == "END_OF_TIMELINE") {
                            _html += "<tr><th>Event:</th><td>End of " + d.duration + " day time window.</td></tr>";
                        }
                    }
                    else {
                        _html += "<tr><th>Duration:</th><td>" + thisvis.msToDays(d.stats.duration) + " Days</td></tr>";

                    }

                    _html += "<tr><th>Size:</th><td>" + d.stats.size + "</td></tr>" +
                    "<tr><th>Outcome:</th><td>" + (d.stats.avgoutcome*100).toFixed(0) + "%</td></tr>";

                    if (d.exclusion != undefined) {
                        _html += "<tr><th>Exclusions:</th><td>";
                        for (let i=0; i<d.exclusion.length; i++) {
                            _html += d.exclusion[i].type.label+"</br>";
                        }
                        _html += "</td></tr>";
                    }
                    _html += "</table></div>";

                    return _html;
                });
            this.svg.call(this.tool_tip);

            // Create the context menu.
            this.contextMenu = new Menu({
                targetNodeIds: [this.containerID],
                selector: 'rect'
            });
            this.filterMenuItem = new MenuItem({
                label: "Filter",
                onClick: function(e){
                    var node = this.getParent().currentTarget;
                    var element_type = d3.select(node).classed("pathway") ? "pathway" : "milestone";
                    var elem_info = { id: node.__data__.id, type: element_type };
                    var args = { type: "timeline", element: elem_info};

                    thisvis.dispatcher.call("filter", thisvis, args);
                }
            });
            this.contextMenu.addChild(this.filterMenuItem);
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
            // Store a reference to the data.
            this.data = this.processDataForVis(init_data);

            this.render();
        }

        update(init_data) {
            // Store a reference to the data.
            this.data = this.processDataForVis(init_data);

            this.render();
        }

        render() {
            let thisvis = this;

            // Define scales
            let color = d3.scaleLinear().domain([thisvis.color_map_min, (thisvis.color_map_min+thisvis.color_map_max)/2.0, thisvis.color_map_max]).range(["green", "#bbbb00", "red"]).clamp(true);

            let timewidth = d3.scaleLinear().domain([0, this.data.max_duration]).range([0, 0.7]);
            let x = d3.scaleLinear().domain([0, this.data.max_layer]).range([0,this.width-this.nodewidth]);
            let y = d3.scaleLinear().domain([0,this.data.size]).range([0,this.height]);

            this.svg.on("click", function(d) {
                thisvis.svg.selectAll(".selectable").classed('timeline_highlight', false);
                thisvis.selectedelem.type = null;
                thisvis.selectedelem.id = null;
                thisvis.dispatcher.call("select", thisvis, null);
            });

            // Draw connection paths.
            var path_connectors = this.svg.selectAll(".pathway_connector").data(this.data.paths, function(d) {return d.id;});
            path_connectors.enter().append("rect")
                .attr("class", "pathway_connector")
                .attr("x", function(d) {return x(d.srcNode.layer);})
                .attr("y", function(d) {return y(d.offset) + 0.25*y(d.stats.size);})
                .attr("width", function(d) {return x(d.destNode.layer-d.srcNode.layer);})
                .attr("height", function(d) {return 0.5*y(d.stats.size);})
                .attr("fill", function(d) {return "#dddddd";})
                .attr("fill-opacity", 0.5)
                .lower();

            path_connectors
                .transition().duration(500)
                    .attr("x", function(d) {return x(d.srcNode.layer);})
                    .attr("y", function(d) {return y(d.offset) + 0.25*y(d.stats.size);})
                    .attr("width", function(d) {return x(d.destNode.layer-d.srcNode.layer);})
                    .attr("height", function(d) {return 0.5*y(d.stats.size);});

            path_connectors.exit()
                .remove();

            // Draw time paths.
            var paths = this.svg.selectAll(".pathway").data(this.data.paths, function(d) {return d.id;});
            paths.enter().append("rect")
                .attr("class", "pathway selectable")
                .attr("x", function(d) {return thisvis.nodewidth + x(d.srcNode.layer);})
                .attr("y", function(d) {return y(d.offset);})
                .attr("width", function(d) {return timewidth(d.stats.duration) * x(1);})
                .attr("height", function(d) {return y(d.stats.size);})
                .attr("fill", function(d) {return color(d.stats.avgoutcome);})
                .attr("stroke-width", 0)
                .style("cursor", "pointer")
                .on("mouseover", thisvis.tool_tip.show)
                .on("mouseout", thisvis.tool_tip.hide)
                .on("click", function(d) {
                    thisvis.selectedelem.type = 'pathway';
                    thisvis.selectedelem.id = d.id;
                    thisvis.svg.selectAll(".selectable").classed('timeline_highlight', false);
                    d3.select(this).raise().classed('timeline_highlight', true);
                    thisvis.dispatcher.call("select", thisvis, d);
                    d3.event.stopPropagation();
                });

            paths
                .transition().duration(500)
                    .attr("x", function(d) {return thisvis.nodewidth + x(d.srcNode.layer);})
                    .attr("y", function(d) {return y(d.offset);})
                    .attr("width", function(d) {return timewidth(d.stats.duration) * x(1);})
                    .attr("fill", function(d) {return color(d.stats.avgoutcome);})
                    .attr("height", function(d) {return y(d.stats.size);});

            paths.exit()
                .remove();

            // Draw nodes and labels.
            var nodes = this.svg.selectAll(".milestone").data(this.data.milestones, function(d) {return d.id;});
            var groups = nodes.enter().append("g")
                .attr("class", "milestone");

            groups.append("rect")
                .attr("class", "selectable")
                .attr("x", function(d) {return x(d.layer);})
                .attr("y", function(d) {return y(d.offset);})
                .attr("height", function(d) { return y(d.offset + d.stats.size) - y(d.offset);})
                .attr("width", this.nodewidth)
                .attr("fill", function(d) {return color(d.stats.avgoutcome);})
                .style("cursor", "pointer")
                .on("mouseover", thisvis.tool_tip.show)
                .on("mouseout", thisvis.tool_tip.hide)
                .on("click", function(d) {
                    thisvis.selectedelem.type = 'milestone';
                    thisvis.selectedelem.id = d.id;
                    thisvis.svg.selectAll(".selectable").classed('timeline_highlight', false);
                    let this_group = d3.select(this.parentElement);
                    this_group.raise();
                    this_group.selectAll("rect").classed('timeline_highlight', true);
                    thisvis.dispatcher.call("select", thisvis, d);
                    d3.event.stopPropagation();
                });


            groups.append("clipPath")
                .attr("id", function(d) {return "clipPath"+d.id;})
                .append("rect")
                    .attr("x", function(d) {return x(d.layer);})
                    .attr("y", function(d) {return y(d.offset)-thisvis.nodewidth;})
                    .attr("height", thisvis.nodewidth)
                    .attr("width", function(d) { return y(d.offset + d.stats.size) - y(d.offset);});


            groups.append("text")
                .attr("x", function(d) {return x(d.layer)+5;})
                .attr("y", function(d) {return y(d.offset)-5;})
                .attr("transform", function(d) {
                    return "rotate(90,"+x(d.layer)+","+y(d.offset)+")"
                })
                .attr("clip-path", function(d) { return "url(#clipPath"+d.id+")";})
                .style("fill", "black")
                .style("stroke-width", 0)
                .style("pointer-events", "none")
                .text(function(d) {
                    if (d.constraint === undefined) {
                        if (d.type == "START_OF_TIMELINE") {
                            return "Start of " + d.duration + " day time window.";
                        }
                        else if (d.type == "END_OF_TIMELINE") {
                            return "End of " + d.duration + " day time window.";
                        }
                        else {
                            return "" + d.duration + " days";
                        }
                    }
                    else {
                        return d.constraint.type.label + "  (" + d.constraint.type.cat + "-" + d.constraint.type.code + ")";
                    }
                });

            nodes.select("rect")
                .transition().duration(500)
                .attr("x", function(d) {return x(d.layer);})
                .attr("y", function(d) {return y(d.offset);})
                .attr("height", function(d) { return y(d.offset + d.stats.size) - y(d.offset);})
                .attr("fill", function(d) {return color(d.stats.avgoutcome);});
            nodes.select("clipPath").select("rect")
                    .transition().duration(500)
                    .attr("x", function(d) {return x(d.layer);})
                    .attr("y", function(d) {return y(d.offset)-thisvis.nodewidth;})
                    .attr("height", thisvis.nodewidth)
                    .attr("width", function(d) { return y(d.offset + d.stats.size) - y(d.offset);});
            nodes.select("text")
                .transition().duration(500)
                .attr("transform", function(d) {
                    return "rotate(90,"+x(d.layer)+","+y(d.offset)+")"
                })
                .attr("x", function(d) {return x(d.layer)+5;})
                .attr("y", function(d) {return y(d.offset)-5;});

            nodes.exit()
                .remove();
        }

        getSelectedElement() {
           return this.selectedelem;
        }

        processDataForVis(server_data) {
            // First we need to traverse the graph to determine the max length path to any node.  This gives us the
            // layout layer for each node.
            let vis_data = {};
            vis_data.milestones = []
            vis_data.paths = []
            vis_data.max_layer = this.processLayers(0, 0, server_data.root, server_data, vis_data.milestones, vis_data.paths);
            vis_data.size = server_data.milestones[server_data.root].stats.size;

            // Find the maximum path duration, used for scaling the visualization.
            vis_data.max_duration = vis_data.paths.reduce(function(partial_result, current_val) {return Math.max(partial_result, current_val.stats.duration)}, 0);

            return vis_data;
        }

        processLayers(next_layer, next_vert_offset, timeline_node_id, server_data, milestones, paths) {
            let milestone = server_data.milestones[timeline_node_id];
            if (milestone.layer === undefined) {
                // This is the first time we've visited this node.  Add it to the milestone list.
                milestones.push(milestone);

                // Also define a layer value and vert offset.
                milestone.layer = next_layer;
                milestone.offset = next_vert_offset;
            }
            else {
                milestone.layer = Math.max(next_layer, milestone.layer);
            }

            let max_layer = milestone.layer;
``
            for (let i=0; i<milestone.pathways.length; i++) {
                let path_id = milestone.pathways[i];
                let path = server_data.paths[path_id];
                if (path.offset == undefined) {
                    path.srcNode = server_data.milestones[milestone.id];
                    path.destNode = server_data.milestones[path.dest];
                    path.offset = next_vert_offset;
                    paths.push(path);
                }
                max_layer = Math.max(max_layer, this.processLayers(next_layer+1, next_vert_offset, path.dest, server_data, milestones, paths));
                next_vert_offset += path.stats.size;
            }

            return max_layer;
        }

        msToDays(time_in_ms) {
            return (time_in_ms / (1000 * 60 * 60 * 24)).toFixed(1);
        }

        updateOutcomeColormapRange(min, max) {
            this.color_map_min = min;
            this.color_map_max = max;
            this.render();
        }
    }

});
