"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/on",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/form/HorizontalSlider",
    "dojo/aspect",
    "cadence/vis/components/ScatterLayoutOptimizer",
    "vaclab/VaclabVis"
], (declare, lang, dom, domConstruct, domStyle, dojoOn, registry, Menu, MenuItem, HorizontalSlider, aspect, ScatterLayoutOptimizer, VaclabVis) => {
    return class extends VaclabVis {

        constructor(dom_container_id) {
            super(dom_container_id, ["select", "filter", "milestone"]);

            // Timeout used to distinguish between a click and a dblclick.
            this.clickTimeout = null;

            this.LAYOUT_MODE = {
                LINEAR: 0,
                LOG: 1,
                OPTIMIZED: 2
            };

            this.SIMPLIFICATION_MODE = {
                LEAF_ONLY: 0,
                STANDARD: 1,
                ALL: 2
            };

            this.FREQUENCY_MODE = {
                ON: 0,
                OFF: 1
            };

            this.PARENT_SPACING_WHEN_OPTIMIZED = 15;

            this.draw_child_arcs = false;
            this.layout_mode = this.LAYOUT_MODE.LINEAR;
            this.layout_mode = this.LAYOUT_MODE.LOG;
            this.layout_mode = this.LAYOUT_MODE.OPTIMIZED;
            this.outline_color = "#cccccc";
            this.scent_color_max = "#666666";
            this.scent_color_min = "#aaaaaa";
            this.optimizer = new ScatterLayoutOptimizer();

            this.simplification_mode = this.SIMPLIFICATION_MODE.STANDARD;
            this.frequency_mode = this.FREQUENCY_MODE.OFF;
            this.confidence_threshold1 = 0;

            // this.outline_color = "#2196f3";

            let thisvis = this;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10) - 30;
            this.margin = 12;
            this.margin_left = 45;
            this.margin_top = 10;

            this.heightOfScents = 5;

            this.annotationR = 3;

            // Add the slider and search box
            let slider1_container_id = this.containerID + "_slider1";
            this.search_container_id = this.containerID + "_search";
            container.innerHTML = "<div style=' font-size: 10px; margin-bottom: 5px; display: flex; flex-wrap: wrap'>" +
                "<div id='"+slider1_container_id+"'>Hierarchy Simplification</div>"+
                "<input type='text' id='"+this.search_container_id+"' style='flex: 1 0 auto;' list = 'scatterList' placeholder='Event search'></input>" +
                "<datalist id='scatterList'></datalist>" +
                "</div>";

            // Init the color map range.
            this.COLOR_MAP_MIN_LIMIT = -0.25;
            this.COLOR_MAP_MAX_LIMIT = 0.25;
            this.color_map_min = this.COLOR_MAP_MIN_LIMIT;
            this.color_map_max = this.COLOR_MAP_MAX_LIMIT;

            // Create the SVG element with the initial size.
            this.svg = d3.select("#"+this.containerID).append("svg")
                .style("height", this.height)
                .style("width", this.width);

            // Create the context menu.
            this.contextMenu = new Menu({
                targetNodeIds: [this.containerID],
                selector: 'circle'
            });
            this.milestoneMenuItem = new MenuItem({
                label: "Add as milestone...",
                onClick: function(e){
                    var node = this.getParent().currentTarget;
                    var args = { type: node.__data__ };
                    thisvis.removeFocus();
                    thisvis.dispatcher.call("milestone", thisvis, args);
                }
            });
            this.contextMenu.addChild(this.milestoneMenuItem);

            // Create Slider



            function setConfidenceThreshold1(value) {
                thisvis.confidence_threshold1 = value;
                thisvis.removeFocusHelper();
                thisvis.render();
            }

            let slider1 = new HorizontalSlider({
                name: slider1_container_id,
                //value: quantileScale.invert(quantile),
                minimum: 0,
                maximum: 1,
                intermediateChanges: false,
                showButtons: false,
                style: "margin-top: 10px; flex: 1 0 auto;",
                onChange: setConfidenceThreshold1
            }, slider1_container_id).startup();

            // Define a generator to draw curves that link points.  The curves for point d will link d to its parent.
            this.curveGenerator = function(x1, y1, x2, y2) {
                let delta_x = 1.0*(x2-x1);
                let delta_y = 1.0*(y2-y1);
                let path = d3.path();
                path.moveTo(x1, y1);
                path.bezierCurveTo(x1, y1 + delta_y, x2 - delta_x, y2, x2, y2);
                //path.bezierCurveTo(x1, y1, x2, y2, x2, y2);
                return path.toString();
            }

            // Define a generator to draw the scent glyph for annotations.  The x point is the center position.  The
            // y point is the top position.
            this.scentGenerator = function(x, y, h, w) {
                let path = d3.path();
                path.moveTo(x, y);
                path.lineTo(x+w/2, y+h);
                path.lineTo(x-w/2, y+h);
                path.closePath();
                return path.toString();
            }

            // Define a generator to draw the scent glyph for annotations that represent leaves.  The x point is the
            // center position.  The y point is the top position.
            this.scentLeafGenerator = function(x, y, h, w) {
                h = 1.0;
                let path = d3.path();
                //path.moveTo(x, y);
                //path.lineTo(x+h, y);
                //path.arcTo(x+h+h, y, x+h+h, y+h, h);
                //path.arcTo(x+h+h, y+h+h, x+h, y+h+h, h);
                //path.lineTo(x-h, y+h+h);
                //path.arcTo(x-h-h, y+h+h, x-h-h, y+h, h);
                //path.arcTo(x-h-h, y, x-h, y, h);

                path.moveTo(x, y);
                path.lineTo(x+2*h, y);
                path.arcTo(x+2*h+2*h, y, x+2*h+2*h, y+h, h);
                path.arcTo(x+2*h+2*h, y+h+h, x+2*h, y+h+h, h);
                path.lineTo(x-2*h, y+h+h);
                path.arcTo(x-2*h-2*h, y+h+h, x-2*h-2*h, y+h, h);
                path.arcTo(x-2*h-2*h, y, x-2*h, y, h);
                path.closePath();
                return path.toString();
            }
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height-30;

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
            let thisvis = this;

            // Create Search Box
            dom.byId(this.search_container_id).onchange = function(e) {
                let option = e.target.list.options.namedItem(e.target.value);

                if (option) {
                    // Remove focus and set the searched event so it can be rendered
                    thisvis.removeFocusHelper();
                    thisvis.search_focus = init_data.events[option.dataset.id];
                    thisvis.last_searched_id = option.dataset.id;
                    thisvis.render();
                }
                else {
                    // When search box is cleared remove event from plot
                    thisvis.search_focus = null;
                    thisvis.last_searched_id = null;
                    thisvis.render();
                }
            };

            // Create Search List
            let scatterList = dom.byId("scatterList");
            scatterList.innerHTML = "";
            d3.values(this.data.events).forEach(function(event) {
                let value = event.code + ": " + event.label;

                let attrs = {
                    name: value,
                    value: value
                };
                attrs["data-id"] = event.id;

                domConstruct.create("option",  attrs, scatterList);
            });

            this.svg.on("click", lang.hitch(this, this.removeFocus))

            // Render the data that does not get updated if data changes (axes, etc.)

            // And chart labels.
            this.svg.append("text")
                .attr('class', 'titletext')
                .attr('x', 0)
                .attr('y', 9)
                .style('fill', 'black')
                .style('text-anchor', 'left')
                .text("Event-Outcome Associations");

            // Setup scales.  First, x axis for correlation.
            this.eoX = d3.scaleLinear().domain([-0.25, 0.25]).range([0, this.width-this.margin-this.margin_left]);
            this.eoX.clamp(true);

            // Now y scale for frequency.
            if ((this.layout_mode == this.LAYOUT_MODE.LINEAR) || (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED)) {
                this.eoY = d3.scaleLinear().domain([1.0/this.data.size, 1]).range([this.height-this.margin-this.margin_left+this.margin_top, 0+this.margin_top]);
            }
            else if (this.layout_mode == this.LAYOUT_MODE.LOG) {
                this.eoY = d3.scaleLog().domain([1.0/this.data.size, 1]).range([this.height-this.margin-this.margin_left+this.margin_top, 0+this.margin_top]);
            }

            // Add axes for scatter plot.
            this.xAxis = d3.axisBottom(this.eoX).ticks(5);

            this.svg.append("g")
                .attr("class","x axis")
                .attr("transform", "translate("+this.margin_left+","+(this.height-this.margin_left+this.margin_top)+")")
                .call(this.xAxis);

            this.yAxis = d3.axisLeft(this.eoY);

            this.svg.append("g")
                .attr("id","eoyaxis")
                .attr("class","y axis")
                .attr("transform", "translate("+this.margin_left+","+this.margin+")")
                .call(this.yAxis);

            this.svg.select("#eoyaxis").append("clipPath")
                .attr("id", "eoyaxis_clip")
                .append("rect")
                    .attr("x", this.eoX(-0.25))
                    .attr("y", this.eoY(1))
                    .attr("width", this.eoX(0.25)-this.eoX(-0.25))
                    .attr("height", this.eoY(0)-this.eoY(1));


            // And axis labels.
            this.svg.append("text")
                .attr('class', 'axistext')
                .attr('x', this.margin_left + (this.width-this.margin-this.margin_left)/2.0)
                .attr('y', this.height - this.margin + this.margin_top)
                .style('fill', 'black')
                .style('text-anchor', 'middle')
                .text("Correlation with Outcome");

            this.svg.append("text")
                .attr('id', 'yaxislabel')
                .attr('class', 'axistext')
                .attr('x', 0)
                .attr('y', 0)
                .style('text-anchor', 'middle')
                .attr("transform", "translate(2,"+(this.margin+(this.width-this.margin-this.margin_left)/2.0)+") rotate(90,0,0)")
                .style('fill', 'black')
                .text("Percentage");

            // Define the tool tip.
            this.tool_tip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-8, 0])
                .html(function(d) { return "<div style='width:150px;'><table>" +
                    "<tr><th>Event:</th><td>" + d.label + "</td></tr>" +
                    "<tr><th>Code:</th><td>" + d.cat + " " + d.code + "</td></tr>" +
                    "<tr><th>Frequency:</th><td>" + d.entitycount + "</td></tr>" +
                    "<tr><th>Correlation:</th><td>" + d.corr.toFixed(2) + "</td></tr>" +
                    "<tr><th>p-Value:</th><td>" + d.pValue.toFixed(3) + "</td></tr>" +
                    "</table></div>"; });
            this.svg.call(this.tool_tip);

            // Define a scale for the scent.  By definition, scents should range from 0 to 2, while
            // in pratcies values tend to be much closer to zero.  We therefore adopt a piecewise
            // linear scale that captures a majority of the range in the 0-0.2 domain.
            this.scentScale = d3.scaleLinear().domain([0,0.2,2.0]).range([0.0,10.0,14.0]).clamp(true);
            this.scentOpacityScale = d3.scaleLinear().domain([0,0.2,2.0]).range([0.0,1.0,1.0]).clamp(true);
            this.scentColorScale = d3.scaleLinear().domain([0.0,1.0]).range([this.scent_color_min, this.scent_color_max]).clamp(true);

            this.render();
        }

        update(new_data) {
            // Store a reference to the data.
            this.data = new_data;
            let thisvis = this;

            if(thisvis.last_searched_id != null){
                thisvis.search_focus = new_data.events[thisvis.last_searched_id];
            }

            // Create Search Box
            dom.byId(this.search_container_id).onchange = function(e) {
                let option = e.target.list.options.namedItem(e.target.value);

                if (option) {
                    // Remove focus and set the searched event so it can be rendered
                    thisvis.removeFocusHelper();
                    thisvis.search_focus = new_data.events[option.dataset.id];
                    thisvis.last_searched_id = option.dataset.id;
                    thisvis.render();
                }else{
                    // When search box is cleared remove event from plot
                    thisvis.search_focus = null;
                    thisvis.last_searched_id = null;
                    thisvis.render();
                }
            };

            // Create Search List
            let scatterList = dom.byId("scatterList");
            scatterList.innerHTML = "";
            d3.values(this.data.events).forEach(function(event) {
                let value = event.code + ": " + event.label;

                let attrs = {
                    name: value,
                    value: value
                };
                attrs["data-id"] = event.id;

                domConstruct.create("option",  attrs, scatterList);
            });

/*
            // Remove any annotations that are on the scatter plot.
            this.svg.selectAll(".annotation").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".annotation_scent").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".annotation_arc").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();

            // Re-render with the new data.
            this.render();
            */
            this.removeFocus();
        }

        render() {
            let thisvis = this;
            var stats_data = this.data;

            // Update the x axis to the normal extents.
            this.eoX.domain([-0.25, 0.25]);
            this.eoX.range([0, this.width-this.margin-this.margin_left]);

            this.svg.select(".x")
                .transition().duration(500).call(this.xAxis);

            let color = d3.scaleLinear().domain([thisvis.color_map_min, (thisvis.color_map_min+thisvis.color_map_max)/2.0, thisvis.color_map_max]).range(["green", "#bbbb00", "red"]).clamp(true);

            // Now select  the informative event data for rendering individually.
            let all_event_array = Object.values(stats_data.events);
            let event_array = all_event_array;

            if(this.frequency_mode == this.FREQUENCY_MODE.ON) {
                console.log("TOTAL EVENTS");
                console.log(all_event_array.length);
                console.log("------------");
                // Average Depth Code
                let total_depth = 0;
                let tot_events = 0;
                all_event_array.forEach(function (d) {
                    let curr_depth = 1;
                    let this_event = d;

                    while (this_event.parent_id !== undefined) {
                        this_event = stats_data.events[this_event.parent_id];
                        curr_depth = curr_depth + 1;
                    }
                    total_depth = total_depth + curr_depth;
                    tot_events = tot_events + 1;
                });
                let avg_depth = total_depth / tot_events;
                console.log("AVERAGE DEPTH OF LEAF NODES");
                console.log(avg_depth);
                console.log("---------------------------");

                // Average Degree Code
                let total_degree = 0;
                tot_events = 0;
                all_event_array.forEach(function (d) {
                    let this_event = d;
                    if (this_event.child_ids !== undefined) {
                        total_degree = total_degree + this_event.child_ids.length;
                        tot_events = tot_events + 1;
                    }
                });
                let avg_degree = total_degree / tot_events;
                console.log("AVERAGE DEGREE OF NON-LEAF NODES");
                console.log(avg_degree);
                console.log("--------------------------------");
            }
            // Setup for generating frequency data
            let icd_tot = 0;
            let sno_tot = 0;
            let bucket_count = 100;
            let freq_dist = new Array(bucket_count).fill(0);
            //let freq_cutoff_icd = new Array(bucket_count+1).fill(0);

            if(this.frequency_mode == this.FREQUENCY_MODE.ON){
                event_array.forEach(function(d){
                    let this_event = d;
                    if(this_event.label == "ICD10CM ROOT"){
                        icd_tot = this_event.entitycount;
                    }
                    if(this_event.label == "SNOMED ROOT"){
                        sno_tot = this_event.entitycount;
                    }

                });
                /*
                for(let i = 0; i < bucket_count; i++){
                    freq_cutoff_icd[i+1] = (i+1)*icd_tot/bucket_count;
                    console.log(freq_cutoff_icd[i]);
                }*/
            }

            //
            if(this.simplification_mode == this.SIMPLIFICATION_MODE.STANDARD){
                // Recalculate informative events based on threshold set by user
                let rel_thres = this.confidence_threshold1;
                event_array = all_event_array.forEach(function(d) {
                    let this_event = d;

                    let curr_yates = this_event.yates;
                    let count = 0;
                    let tot = 0;

                    if (this_event.child_ids !== undefined){
                        for (let i = 0; i < this_event.child_ids.length; i++){
                            if((stats_data.events[this_event.child_ids[i]]).yates>curr_yates){
                                count = count + 1;
                            }
                            tot = tot+1;
                        }
                    }

                    if(d.root){
                        d.informative = false;
                    }else if(count/tot > rel_thres){
                        d.informative = false;
                    }else{
                        d.informative = true;
                    }
                });

                let abs_thres = 0;
                event_array = all_event_array.filter(function(d) {
                    let this_event = d;
                    let highest_level = true;

                    while (this_event.parent_id !== undefined) {
                        if((stats_data.events[this_event.parent_id]).informative == true){
                            highest_level = false;
                        }
                        this_event = stats_data.events[this_event.parent_id];
                    }
                    if(d.informative && highest_level &&  d.yates > abs_thres){
                        return true;
                    }else if(thisvis.search_focus != null && d == thisvis.search_focus){
                        return true;
                    }else{
                        return false;
                    }

                });

                if(this.frequency_mode == this.FREQUENCY_MODE.ON){
                    let count = 0;
                    event_array.forEach(function(d){
                        //if(d.cat == "ICD10CM") {
                        //if(d.cat == "SNOMED") {
                            count++;
                        //}
                    });
                    console.log(count);
                    console.log(icd_tot);
                    //console.log(sno_tot);
                    event_array.forEach(function(d){
                        let this_event = d;
                        //if(this_event.cat == "ICD10CM"){
                        //if(this_event.cat == "SNOMED"){
                            freq_dist[Math.floor(this_event.entitycount/(icd_tot/bucket_count))]++;
                            //freq_dist[Math.floor(this_event.entitycount/(sno_tot/bucket_count))]++;
                        //}
                    });
                    console.log(freq_dist);


                }

            }else if (this.simplification_mode == this.SIMPLIFICATION_MODE.LEAF_ONLY){
                event_array = all_event_array.filter(function(d) {
                    let this_event = d;

                    if (this_event.child_ids == undefined) {
                        return true;
                    }else if(thisvis.search_focus != null && d == thisvis.search_focus){
                        return true;
                    }else{
                        return false;
                    }
                });
                if(this.frequency_mode == this.FREQUENCY_MODE.ON){
                    let count = 0;
                    event_array.forEach(function(d){
                        //if(d.cat == "ICD10CM") {
                        //if(d.cat == "SNOMED") {
                            count++;
                        //}
                    });
                    console.log(count);
                    console.log(icd_tot);
                    //console.log(sno_tot);
                    event_array.forEach(function(d){
                        let this_event = d;
                        //if(this_event.cat == "ICD10CM"){
                        //if(this_event.cat == "SNOMED"){
                            freq_dist[Math.floor(this_event.entitycount/(icd_tot/bucket_count))]++;
                            //freq_dist[Math.floor(this_event.entitycount/(sno_tot/bucket_count))]++;
                        //}
                    });
                    console.log(freq_dist);
                }
            }

            event_array.sort(function(a,b) {
                return a.corr > b.corr;
            })

            // Draw hexbins for all events.
            let bin_data =all_event_array.map(function(d) {return [thisvis.eoX(d.corr), thisvis.eoY(d.entitycount / thisvis.data.size)];});

            let x_range = thisvis.eoX.range();
            let y_range = thisvis.eoY.range();
            let hexbin = d3.hexbin().extent([[x_range[0],y_range[1]],[x_range[1],y_range[0]]]).radius(8);
            let hexbin_data = hexbin(bin_data);
            let grayscale = d3.scaleLinear().domain([0, 500]).range(["#eaeaea", "#bbbbbb"]).clamp(true);

            let bins = this.svg.select("#eoyaxis").selectAll(".hexbins").data(hexbin_data, function(d) { return d.x + "," + d.y; });

            bins.exit().transition().delay(400)
                .duration(800)
                    .style("fill", "#ffffff")
                    .remove();

            bins.transition().delay(!bins.exit().empty()*400).duration(800)
                .style("fill", function(d) {
                    return grayscale(d.length);
                });

            bins.enter().append("path")
                    .attr("clip-path", "url(#eoyaxis_clip)")
                    .attr("class", "hexbins")
                    .style("fill", function(d) {
                        return "#ffffff";
                    })
                    .attr("d", function(d) { return "M" + d.x + "," + d.y + hexbin.hexagon(); })
                    .lower()
                        .transition().delay(!bins.exit().empty()*400).duration(800)
                        .style("fill", function(d) {
                                return grayscale(d.length);
                            });

            let events = this.svg.select("#eoyaxis").selectAll(".event").data(event_array, function(d) {return d.id;});

            events.enter().append("circle")
                .attr("class", "event")
                .attr("cx", function(d) {return thisvis.eoX(d.corr);})
                .attr("cy", function(d) {return thisvis.eoY(d.entitycount / thisvis.data.size);})
                .attr("r", function(d) {return thisvis.annotationR;})
                .style("fill", function(d) {
                    if(thisvis.search_focus != null && d == thisvis.search_focus){
                        return "#2196f3";
                    }
                    return color(d.corr);})
                .attr("opacity",0.0)
                .on("mouseover", lang.hitch(thisvis, thisvis.showMouseover))
                .on("mouseout", lang.hitch(thisvis, thisvis.hideMouseout))
                .on("dblclick", lang.hitch(thisvis, thisvis.setSearchByClick))
                .on("click", lang.hitch(thisvis, thisvis.applyFocus))
                .transition().delay(!events.exit().empty()*400 + !events.empty()*800).duration(400)
                    .attr("opacity",1.0);

            events
                .on("click", lang.hitch(thisvis, thisvis.applyFocus))
                .transition().delay(!events.exit().empty()*400).duration(800)
                .attr("r", function(d) {return thisvis.annotationR;})
                .attr("cx", function(d) {return thisvis.eoX(d.corr);})
                .attr("cy", function(d) {return thisvis.eoY(d.entitycount / thisvis.data.size);})
                .style("fill", function(d) {
                    if(thisvis.search_focus != null && d == thisvis.search_focus){
                        return "#2196f3";
                    }
                    return color(d.corr);})
                .style("stroke-width", 0)
                .attr("opacity",1.0);

            events.exit()
                .transition().duration(400)
                    .attr("r", function(d) {return thisvis.annotationR;})
                    .attr("cx", function(d) {return thisvis.eoX(d.corr);})
                    .attr("cy", function(d) {return thisvis.eoY(d.entitycount / thisvis.data.size);})
                    .style("opacity",0.0)
                    .remove();
            if(thisvis.search_focus != null){
                let searched_events = this.svg.select("#eoyaxis").selectAll(".event").data([thisvis.search_focus], function(d) {return d.id;});
                searched_events.raise();
            }

        }

        showAnnotations(this_id, children_ids, parent_ids, center_corr) {
            let thisvis = this;

            // Hide the y axis if the axis will be distorted via optimized layout.
            if (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED) {
                this.svg.select("#eoyaxis").selectAll(".tick").transition().duration(500).style("opacity", 0);
                this.svg.select("#eoyaxis").selectAll(".domain").transition().duration(500).style("opacity", 0);
                this.svg.selectAll("#yaxislabel").transition().duration(500).style("opacity", 0);
            }

            let color = d3.scaleLinear().domain([thisvis.color_map_min, (thisvis.color_map_min+thisvis.color_map_max)/2.0, thisvis.color_map_max]).range(["green", "#bbbb00", "red"]).clamp(true);

            let children = (children_ids === undefined) ? [] : children_ids.map(function(d) {
                return thisvis.data.events[d];
            });
            let parents = (parent_ids === undefined) ? [] : parent_ids.map(function(d) {
                return thisvis.data.events[d];
            });

            // Determine the parent and focus node y values.
            let parent_y_values = null;
            let focus_y_value = null;
            if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                parent_y_values = [];
                for (let i = parents.length-1; i>=0; i--) {
                    parent_y_values.push(this.margin_top + i*this.PARENT_SPACING_WHEN_OPTIMIZED);
                }
                focus_y_value = this.margin_top + parents.length * this.PARENT_SPACING_WHEN_OPTIMIZED;
            }
            else {
                parent_y_values = [];
                for (let parent of parents) {
                    parent_y_values.push(thisvis.eoY(parent.entitycount / thisvis.data.size));
                }
                focus_y_value =thisvis.eoY(thisvis.data.events[this_id].entitycount / thisvis.data.size);
            }

            // Next determine the child node y values.
            let child_y_values = null;
            if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                child_y_values = thisvis.optimizer.layout(parents, children, thisvis.eoY(thisvis.data.events[this_id].entitycount / thisvis.data.size), focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED, thisvis.eoX, thisvis.eoY, thisvis.data.size);
            }
            else {
                child_y_values = [];
                for (let child of children) {
                    child_y_values.push(thisvis.eoY(child.entitycount / thisvis.data.size));
                }
            }


            let all_related_events = parents.concat(children);
            let all_y_values = parent_y_values.concat(child_y_values);

            // Draw the arcs for each annotation.
            let annotation_arcs = null;
            if (thisvis.draw_child_arcs == true) {
                annotation_arcs = this.svg.select("#eoyaxis").selectAll(".annotation_arc").data([thisvis.data.events[this_id]].concat(all_related_events).filter((d)=>d.parent_id!==undefined), function(d) {return d.id;});
            }
            else {
                annotation_arcs = this.svg.select("#eoyaxis").selectAll(".annotation_arc").data([thisvis.data.events[this_id]].concat(parents).filter((d)=>d.parent_id!==undefined), function(d) {return d.id;});
            }

            annotation_arcs.enter().insert("path", ":first-child")
                .attr("class", "annotation_arc")
                .attr("d", function(d,i) {
                    let parent = thisvis.data.events[d.parent_id];
                    let this_y = 0;
                    let parent_y = 0;
                    if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                        parent_y = all_y_values[i];
                        this_y = (i>0 ? all_y_values[i-1] : focus_y_value);
                    }
                    else {
                        this_y = thisvis.eoY(d.entitycount / thisvis.data.size);
                        parent_y = thisvis.eoY(parent.entitycount / thisvis.data.size);
                    }
                    return thisvis.curveGenerator(thisvis.eoX(d.corr), this_y, thisvis.eoX(parent.corr), parent_y); })
                .attr("stroke", thisvis.outline_color)
                .style("stroke-width", 1)
                .style("opacity",0.0)
                .transition().delay(1000).duration(500)
                .style("opacity",1.0);
            annotation_arcs.transition().delay(500).duration(500)
                .attr("d", function(d) {
                    let parent = thisvis.data.events[d.parent_id];
                    let this_y = 0;
                    let parent_y = 0;
                    if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                        parent_y = all_y_values[i];
                        this_y = (i>0 ? all_y_values[i-1] : focus_y_value);
                    }
                    else {
                        this_y = thisvis.eoY(d.entitycount / thisvis.data.size);
                        parent_y = thisvis.eoY(parent.entitycount / thisvis.data.size);
                    }
                    return thisvis.curveGenerator(thisvis.eoX(d.corr), this_y, thisvis.eoX(parent.corr), parent_y); });
            annotation_arcs.exit().transition().duration(500)
                .style("opacity",0.0)
                .remove();

            // Draw the annotation scents
            let focus_id = this_id;
            let annotation_scents = this.svg.select("#eoyaxis").selectAll(".annotation_scent").data(all_related_events.concat(thisvis.data.events[this_id]), function(d) {return d.id;});
            let all_y_values_with_focus = all_y_values.concat([focus_y_value]);

            annotation_scents.enter().append("path")
                .attr("class", "annotation_scent")
                .attr("d", function(d,i) {
                    let x = thisvis.eoX(d.corr);
                    let y = all_y_values_with_focus[i] + ((d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR);
                    let h = 0;
                    let w = thisvis.scentScale(d.scent);
                    if (d.scent >= 0) {
                        return thisvis.scentGenerator(x,y,h,w);
                    }
                    else {
                        return thisvis.scentLeafGenerator(x,y,h,w);
                    }
                })
                .on("mouseover", lang.hitch(thisvis, thisvis.showMouseover))
                .on("mouseout", lang.hitch(thisvis, thisvis.hideMouseout))
                .on("click", lang.hitch(thisvis, thisvis.reviseFocus))
                .style("fill", function(d) { return thisvis.scentColorScale(thisvis.scentOpacityScale(d.scent)); })
                .style("stroke", function(d) { return thisvis.scentColorScale(thisvis.scentOpacityScale(d.scent)); })
                .style("stroke-width", 0.5)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .transition().delay(1000).duration(500)
                    .style("opacity",1)
                    .style("stroke-opacity",1)
                    .attr("d", function(d,i) {
                        let x = thisvis.eoX(d.corr);
                        let y = all_y_values_with_focus[i] + ((d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR);
                        let w = thisvis.scentScale(d.scent);
                        if (d.scent >= 0) {
                            let h = thisvis.heightOfScents;
                            return thisvis.scentGenerator(x,y,h,w);
                        }
                        else {
                            let h = thisvis.heightOfScents;
                            return thisvis.scentLeafGenerator(x,y,h,w);
                        }
                    });

            annotation_scents.transition().delay(500).duration(500)
                .attr("d", function(d,i) {
                    let x = thisvis.eoX(d.corr);
                    let y = all_y_values_with_focus[i] + ((d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR);
                    let w = thisvis.scentScale(d.scent);
                    if (d.scent >= 0) {
                        let h = thisvis.heightOfScents;
                        return thisvis.scentGenerator(x,y,h,w);
                    }
                    else {
                        let h = thisvis.heightOfScents;
                        return thisvis.scentLeafGenerator(x,y,h,w);
                    }
                });

            annotation_scents.exit().transition().duration(500)
                .style("opacity",0)
                .style("stroke-opacity",0)
                .remove();

            // Draw the circles for each annotation.
            let annotations = this.svg.select("#eoyaxis").selectAll(".annotation").data(all_related_events, function(d) {return d.id;});

            annotations.enter().append("circle")
                .attr("class", "annotation")
                .attr("cx", function(d) {
                    return thisvis.eoX(d.corr);

                })
                .attr("cy", function(d,i) {
                    //return thisvis.eoY(d.entitycount / thisvis.data.size);
                    return all_y_values[i];
                })
                .attr("r", 0)
                .on("mouseover", lang.hitch(thisvis, thisvis.showMouseover))
                .on("mouseout", lang.hitch(thisvis, thisvis.hideMouseout))
                .on("click", lang.hitch(thisvis, thisvis.reviseFocus))
                .on("dblclick", lang.hitch(thisvis, thisvis.setSearchByClick))
                .style("fill", function(d) { return color(d.corr); })
                .style("stroke", function(d) {
                    if (d.id == this_id) {
                        return "gold";
                    }
                    else {
                        return thisvis.outline_color;
                    }
                })
                .style("stroke-width", 0.5)
                .transition().delay(1000).duration(500)
                .attr("r", thisvis.annotationR);

            annotations.transition().delay(500).duration(500)
                .attr("cx", function(d) {
                    return thisvis.eoX(d.corr);
                })
                .attr("cy", function(d) {
                    //return thisvis.eoY(d.entitycount / thisvis.data.size);
                    return all_y_values[i];
                })
                .attr("r", thisvis.annotationR);

            annotations.exit().transition().duration(500)
                .attr("r", 0).remove();
        }

        showMouseover(d) {
            // Display tool tip.
            this.tool_tip.show(d);
        }

        hideMouseout(d) {
            // Hide the tool tip.
            this.tool_tip.hide(d);
        }

        reviseFocus(d) {
            clearTimeout(this.clickTimeout);
            if (d3.event != null) {
                d3.event.stopPropagation();
            }
            this.clickTimeout = setTimeout(lang.hitch(this, this.reviseFocusHelper), 300, d);
        }

        reviseFocusHelper(d) {
            this.tool_tip.hide(d);

            // If the new focus is the same as the old focus, ignore the event except for stopping propagation.
            if (d == this.focused_data)  {
                return;
            }

            let thisvis = this;

            let color = d3.scaleLinear().domain([thisvis.color_map_min, (thisvis.color_map_min+thisvis.color_map_max)/2.0, thisvis.color_map_max]).range(["green", "#bbbb00", "red"]).clamp(true);

            // Select the moused-over element.
            let this_event = d;

            // Get list of parent ID and child IDs.
            let parent_ids = undefined;
            let parents_array = [];
            if (this_event.parent_id !== undefined) {
                parent_ids = [];
                while (this_event.parent_id !== undefined) {
                    parent_ids.push(this_event.parent_id);
                    this_event = this.data.events[this_event.parent_id];
                }
                parents_array = parent_ids.map(function(d) { return thisvis.data.events[d]; });
            }

            let children_array = (d.child_ids == undefined) ? [] : d.child_ids.map(function(d) { return thisvis.data.events[d]; });
            let parents_and_children_array = parents_array.concat(children_array);

            // Define a new x axis, centered at the focal correlation value.
            this.eoX.domain([d.corr-0.25, d.corr+0.25]);

            this.svg.select(".x")
                .transition().delay(500).duration(500).call(this.xAxis);

            let parent_y_values = null;
            let focus_y_value = null;
            if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                parent_y_values = [];
                for (let i = parents_array.length-1; i>=0; i--) {
                    parent_y_values.push(this.margin_top + i*this.PARENT_SPACING_WHEN_OPTIMIZED);
                }
                focus_y_value = this.margin_top + parents_array.length * this.PARENT_SPACING_WHEN_OPTIMIZED;
            }
            else {
                parent_y_values = [];
                for (let parent of parents_array) {
                    parent_y_values.push(thisvis.eoY(parents_array.entitycount / thisvis.data.size));
                }
                focus_y_value = thisvis.eoY(thisvis.data.events[d.id].entitycount / thisvis.data.size);
            }

            let child_y_values = null;
            if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                child_y_values = thisvis.optimizer.layout(parents_array, children_array, thisvis.eoY(thisvis.data.events[d.id].entitycount / thisvis.data.size), focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED, thisvis.eoX, thisvis.eoY, thisvis.data.size);
            }
            else {
                child_y_values = [];
                for (let child of children_array) {
                    child_y_values.push(thisvis.eoY(child.entitycount / thisvis.data.size));
                }
            }
            let parent_and_child_y_values = parent_y_values.concat(child_y_values);
            let all_y_values = [focus_y_value].concat(parent_and_child_y_values);


            // Update the child line
            if (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED) {
                this.svg.select("#eoyaxis").selectAll(".childheader")
                    .transition().delay(500).duration(500)
                        .attr("height", focus_y_value + (0*this.PARENT_SPACING_WHEN_OPTIMIZED))
                        .style("stroke-opacity", (parent_y_values.length < 1 ? 0.0 : 1.0) )
                        .style("fill-opacity", (parent_y_values.length < 1 ? 0.0 : 0.2) );
                this.svg.select("#eoyaxis").selectAll(".childline")
                    .transition().delay(500).duration(500)
                    .attr("y1", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED);
                this.svg.select("#eoyaxis").selectAll(".childlabel")
                    .transition().delay(500).duration(500)
                    .attr("y", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .text(numeral(d.entitycount/thisvis.data.size).format("0%"));
                this.svg.select("#eoyaxis").selectAll(".childlabel_ancestors")
                    .transition().delay(500).duration(500)
                    .style("opacity", (parent_y_values.length < 1 ? 0.0 : 1.0));
                this.svg.select("#eoyaxis").selectAll(".childlabel_children")
                    .transition().delay(500).duration(500)
                    .attr("y", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED+2);
                this.svg.select("#eoyaxis").selectAll(".childlegline")
                    .transition().delay(500).duration(500)
                        .style("stroke", color(d.corr))
                        .attr("x1", this.eoX(d.corr))
                        .attr("x2", this.eoX(d.corr))
                        .attr("y1", focus_y_value)
                        .attr("y2", this.eoY(0));
                this.svg.select("#eoyaxis").selectAll(".childzeroline")
                    .transition().delay(500).duration(500)
                    .attr("x1", this.eoX(0))
                    .attr("x2", this.eoX(0))
                    .attr("y1", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", this.eoY(0));
                this.svg.select("#eoyaxis").selectAll(".childsideline")
                    .transition().delay(500).duration(500)
                    .attr("y1", focus_y_value + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", this.eoY(0));
            }

            // Fade out the event circle (there should only be one if we are revising) if it is not a parent or child
            // of the new focus.  If the event circle is a parent or child, we need to convert an annotation.
            let circles = this.svg.select("#eoyaxis").selectAll(".event").data([this.focused_data], function(d) {return d.id;});
            let focus_index = parents_and_children_array.indexOf(this.focused_data);
            if (focus_index >= 0) {
                circles
                    .classed("event", false)
                    .classed("newannotation", true)
                    .transition().delay(500).duration(500)
                        .attr("cx", function(d) {
                            return thisvis.eoX(d.corr);
                        })
                        .attr("cy", function(d) {
                            if (thisvis.layout_mode === thisvis.LAYOUT_MODE.OPTIMIZED) {
                                return parent_and_child_y_values[focus_index];
                            }
                            else {
                                return thisvis.eoY(d.entitycount / thisvis.data.size);
                            }
                           /* let old_focus_index = children_array.indexOf(d);
                            if (old_focus_index >= 0) {
                                return child_y_values[old_focus_index];
                            }
                            else {
                                return parent_y_values[parents_array.indexOf(d)];
                            }*/
                        })
                        .style("fill", function(d) { return color(d.corr); })
                        .style("stroke-width", 0.5)
                        .style("opacity", 1.0)
                        .style("stroke-opacity", 1.0)
                        .style("stroke", thisvis.outline_color)
                        .attr("r",thisvis.annotationR);
            }
            else {
                circles.classed("event", false)
                    .classed("oldevent", true)
                    .transition().duration(500)
                        .style("opacity",0.0)
                        .remove();
            }

            // Draw the arcs for each annotation.
            let annotation_arcs = null;
            if (thisvis.draw_child_arcs == true) {
                annotation_arcs = this.svg.select("#eoyaxis").selectAll(".annotation_arc").data([thisvis.data.events[d.id]].concat(parents_and_children_array).filter((d)=>d.parent_id!==undefined), function(d) {return d.id;});
            }
            else {
                annotation_arcs = this.svg.select("#eoyaxis").selectAll(".annotation_arc").data([thisvis.data.events[d.id]].concat(parents_array).filter((d)=>d.parent_id!==undefined), function(d) {return d.id;});
            }

            annotation_arcs.enter().insert("path", ":first-child")
                .attr("class", "annotation_arc")
                .attr("d", function(d,i) {
                    let parent = thisvis.data.events[d.parent_id];
                    let parent_y = null;
                    let this_y = null;
                    if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                        this_y = all_y_values[i];
                        parent_y = all_y_values[i+1];
                    }
                    else {
                        this_y = thisvis.eoY(d.entitycount / thisvis.data.size);
                        parent_y = thisvis.eoY(parent.entitycount / thisvis.data.size);
                    }
                    return thisvis.curveGenerator(thisvis.eoX(d.corr), this_y,
                            thisvis.eoX(parent.corr), parent_y);
                })
                .style("stroke", thisvis.outline_color)
                .style("stroke-width", 1)
                .style("opacity",0.0)
                .transition().delay(1000).duration(500)
                .style("opacity",1.0);
            annotation_arcs.transition().delay(500).duration(500)
                .attr("d", function(d,i) {
                    let parent = thisvis.data.events[d.parent_id];
                    let parent_y = null;
                    let this_y = null;
                    if (thisvis.layout_mode == thisvis.LAYOUT_MODE.OPTIMIZED) {
                        this_y = all_y_values[i];
                        //parent_y = (i>0 ? all_y_values[i+1] : focus_y_value);
                        parent_y = all_y_values[i+1]
                    }
                    else {
                        this_y = thisvis.eoY(d.entitycount / thisvis.data.size);
                        parent_y = thisvis.eoY(parent.entitycount / thisvis.data.size);
                    }
                    /*                    return thisvis.curveGenerator(thisvis.eoX(d.corr), thisvis.eoY(d.entitycount / thisvis.data.size),
                                            thisvis.eoX(parent.corr), thisvis.eoY(parent.entitycount / thisvis.data.size)
                                        ); })*/
                    return thisvis.curveGenerator(thisvis.eoX(d.corr), this_y,
                        thisvis.eoX(parent.corr), parent_y);
                    /*return thisvis.curveGenerator(thisvis.eoX(d.corr), thisvis.eoY(d.entitycount / thisvis.data.size),
                        thisvis.eoX(parent.corr), thisvis.eoY(parent.entitycount / thisvis.data.size)
                    );*/
                });
            annotation_arcs.exit().transition().duration(500)
                .style("opacity",0.0)
                .remove();

            // Draw the scents for each annotation.
            let focus_id = d.id;
            let annotation_scents = this.svg.select("#eoyaxis").selectAll(".annotation_scent").data([thisvis.data.events[d.id]].concat(parents_and_children_array), function(d) {return d.id;});
            //annotation_scents.enter().insert("path", ":first-child")
            annotation_scents.enter().append("path")
                .attr("class", "annotation_scent")
                .attr("d", function(d,i) {
                    let x = thisvis.eoX(d.corr);
                    //let y = thisvis.eoY(d.entitycount / thisvis.data.size) + thisvis.annotationR;
                    let y = all_y_values[i] + thisvis.annotationR;
                    let w = thisvis.scentScale(d.scent);
                    let h = 0;
                    if (d.scent >= 0) {
                        return thisvis.scentGenerator(x,y,h,w);
                    }
                    else {
                        return thisvis.scentLeafGenerator(x,y,h,w);
                    }
                })
                .on("mouseover", lang.hitch(thisvis, thisvis.showMouseover))
                .on("mouseout", lang.hitch(thisvis, thisvis.hideMouseout))
                .on("click", lang.hitch(thisvis, thisvis.reviseFocus))
                .style("fill", function(d) { return thisvis.scentColorScale(thisvis.scentOpacityScale(d.scent)); })
                .style("stroke", function(d) { return thisvis.scentColorScale(thisvis.scentOpacityScale(d.scent)); })
                .style("stroke-width", 0.5)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .transition().delay(1000).duration(500)
                    .style("opacity", 1)
                    .style("stroke-opacity", 1)
                    .attr("d", function(d,i) {
                        let x = thisvis.eoX(d.corr);
                        let y = 0;
                        if (thisvis.layout_mode === thisvis.LAYOUT_MODE.OPTIMIZED) {
                            y = all_y_values[i] + ((d.id === focus_id) ? 2 * thisvis.annotationR : thisvis.annotationR);
                        }
                        else {
                            y = thisvis.eoY(d.entitycount / thisvis.data.size) + ((d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR);
                        }
                        let w = thisvis.scentScale(d.scent);
                        if (d.scent >= 0) {
                            let h = thisvis.heightOfScents;
                            return thisvis.scentGenerator(x,y,h,w);
                        }
                        else {
                            let h = thisvis.heightOfScents;
                            return thisvis.scentLeafGenerator(x,y,h,w);
                        }
                    });
            annotation_scents.transition().delay(500).duration(500)
                .attr("d", function(d,i) {
                    let x = thisvis.eoX(d.corr);
                    let y = 0;
                    if (thisvis.layout_mode === thisvis.LAYOUT_MODE.OPTIMIZED) {
                        y = all_y_values[i] + ((d.id === focus_id) ? 2 * thisvis.annotationR : thisvis.annotationR);
                    }
                    else {
                        y = thisvis.eoY(d.entitycount / thisvis.data.size) + ((d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR);
                    }
                    let w = thisvis.scentScale(d.scent);
                    if (d.scent >= 0) {
                        let h = thisvis.heightOfScents;
                        return thisvis.scentGenerator(x,y,h,w);
                    }
                    else {
                        let h = thisvis.heightOfScents;
                        return thisvis.scentLeafGenerator(x,y,h,w);
                    }
                });
            annotation_scents.exit().transition().duration(500)
                .style("opacity",0)
                .style("stroke-opacity",0)
                .remove();

            // Revise existing annotations: updates for existing children and parents, add ones for new parents/children.
            // For the focus event, convert annotation (which must exist since the focus was changed to it via interaction)
            // to event.
            // Add one to the findIndex result because all_y_values has [d] as the first y value.
            let index_of_old_focus = parents_and_children_array.findIndex(function(e) { return e.id === thisvis.focused_data.id; })
            if (index_of_old_focus >= 0) {
                all_y_values.splice(1+ index_of_old_focus,1);
            }
            let data_array = [d].concat(parents_and_children_array).filter(function(d) {return d.id !== thisvis.focused_data.id;});
            circles = this.svg.select("#eoyaxis").selectAll(".annotation").data(data_array, function(d) { return d.id; });

            // update existing annotations.
            circles
                .classed("event", function(d) {return d.id === focus_id;})
                .classed("annotation", function(d) { return d.id !== focus_id;})
                .transition().delay(500).duration(500)
                .attr("cx", function(d) {return thisvis.eoX(d.corr);})
                .attr("cy", function(d,i) {
                    if (thisvis.layout_mode === thisvis.LAYOUT_MODE.OPTIMIZED) {
                        return all_y_values[i];
                    } else {
                        return thisvis.eoY(d.entitycount / thisvis.data.size);
                    }
                })
                .style("stroke-width", function(d) { return (d.id === focus_id) ? 0 : 0.5;})
                .style("fill", function(d) { return color(d.corr); })
                .style("stroke", thisvis.outline_color)
                .attr("r", function(d) {return (d.id === focus_id) ? 2*thisvis.annotationR : thisvis.annotationR;});

            // Add new annotations as needed.
            circles.enter().append("circle")
                .attr("class", "annotation")
                .attr("cx", function(d) {
                    return thisvis.eoX(d.corr);
                })
                .attr("cy", function(d,i) {
                    if (thisvis.layout_mode === thisvis.LAYOUT_MODE.OPTIMIZED) {
                        return all_y_values[i];
                    } else {
                        return thisvis.eoY(d.entitycount / thisvis.data.size);
                    }
                })
                .attr("r", 0)
                .on("mouseover", lang.hitch(thisvis, thisvis.showMouseover))
                .on("mouseout", lang.hitch(thisvis, thisvis.hideMouseout))
                .on("click", lang.hitch(thisvis, thisvis.reviseFocus))
                .on("dblclick", lang.hitch(thisvis, thisvis.setSearchByClick))
                .style("fill", function(d) {return color(d.corr);})
                .style("stroke", thisvis.outline_color)
                .style("stroke-width", 0.5)
                .transition().delay(1000).duration(500)
                .attr("r", thisvis.annotationR);

            // Remove annotations that are no longer needed.
            circles.exit().transition().duration(500)
                .style("opacity",0.0)
                .remove();

            circles = this.svg.select("#eoyaxis").selectAll(".newannotation")
                .classed("annotation", true)
                .classed("newannotation", false);

            this.focused_data = d;
        }

        removeFocus(d) {
            clearTimeout(this.clickTimeout);
            if (d3.event != null) {
                d3.event.stopPropagation();
            }
            this.clickTimeout = setTimeout(lang.hitch(this, this.removeFocusHelper), 300, d);
        }

        removeFocusHelper(d) {
            // Remove any annotations that are on the scatter plot.
            this.svg.selectAll(".annotation").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".annotation_arc").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".annotation_scent").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childheader").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childline").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childlabel").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childlabel_children").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childlabel_ancestors").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childlegline").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childzeroline").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();
            this.svg.selectAll(".childsideline").transition().duration(500)
                .style("opacity",0.0)
                .style("stroke-opacity",0.0)
                .remove();

            // Show the y axis.
            if (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED) {
                this.svg.select("#eoyaxis").selectAll(".tick").transition().duration(500).style("opacity",1);
                this.svg.select("#eoyaxis").selectAll(".domain").transition().duration(500).style("opacity",1);
                this.svg.selectAll("#yaxislabel").transition().duration(500).style("opacity",1);
            }

            // Reset the main visualization.
            this.render();

            this.focused_data = null;
        }

        applyFocus(d) {
            clearTimeout(this.clickTimeout);
            if (d3.event != null) {
                d3.event.stopPropagation();
            }
            this.clickTimeout = setTimeout(lang.hitch(this, this.applyFocusHelper), 300, d);
        }

        applyFocusHelper(d) {
            let thisvis = this;

            let color = d3.scaleLinear().domain([thisvis.color_map_min, (thisvis.color_map_min+thisvis.color_map_max)/2.0, thisvis.color_map_max]).range(["green", "#bbbb00", "red"]).clamp(true);

            this.tool_tip.hide(d);

            // Select the moused-over element.
            let moused_element = d3.select(this);

            // Define a new x axis, centered at the focal correlation value.
            this.eoX.domain([d.corr-0.25, d.corr+0.25]);

            this.svg.select(".x")
                .transition().delay(500).duration(500).call(this.xAxis);

            // Fade out the hexbins.
            this.svg.selectAll(".hexbins").transition().duration(500)
                .style("opacity",0.0)
                .remove();

            // Fade out all event circles except the matching one.
            let circles = this.svg.selectAll(".event").data([d], function(d) { return d.id; });
            circles.exit().transition().duration(500)
                .style("opacity",0.0)
                .remove();

            // Get list of parent ID and child IDs.
            let this_event = d;
            let parent_ids = [];
            if (this_event.parent_id !== undefined) {
                while (this_event.parent_id !== undefined) {
                    parent_ids.push(this_event.parent_id);
                    this_event = this.data.events[this_event.parent_id];
                }
            }

            // For the matching event, update event handler for click event and update its position.
            let y_position;
            if (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED) {
                y_position = this.margin_top + parent_ids.length * this.PARENT_SPACING_WHEN_OPTIMIZED;
            } else {
                y_position = thisvis.eoY(d.entitycount / thisvis.data.size);
            }
            circles
                .on("click", lang.hitch(thisvis, thisvis.reviseFocus))
                .transition().delay(500).duration(500)
                    .attr("cx", function(d) {return thisvis.eoX(d.corr);})
                    .attr("cy", y_position)
                    .attr("r",6);

            if (this.layout_mode == this.LAYOUT_MODE.OPTIMIZED) {
                // Show the child line.
                this.svg.select("#eoyaxis").insert("rect", ":first-child")
                    .attr("class", "childheader")
                    .attr("x", this.eoX(-100))
                    .attr("width", this.eoX(100) - this.eoX(-100))
                    .attr("y", 0)
                    .attr("height", y_position + (0*this.PARENT_SPACING_WHEN_OPTIMIZED))
                    .style("fill-opacity", 0)
                    .style("fill", this.outline_color)
                    .style("stroke", this.outline_color)
                    .style("stroke-opacity", 0)
                    .transition().delay(750).duration(500)
                        .style("stroke-opacity", (parent_ids.length < 1 ? 0.0 : 1.0))
                        .style("fill-opacity", (parent_ids.length < 1 ? 0.0 : 0.2));
                this.svg.select("#eoyaxis").insert("line", ":first-child")
                    .attr("class", "childline")
                    .attr("x1", this.eoX(-100))
                    .attr("x2", this.eoX(100))
                    .attr("y1", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .style("stroke-opacity", 0)
                    .style("stroke", this.outline_color)
                    .style("stroke-width", 1)
                    .transition().delay(750).duration(500)
                    .style("stroke-opacity", 1);
                this.svg.select("#eoyaxis").insert("text", ":first-child")
                    .attr("class", "childlabel")
                    .attr("x", this.eoX(-100)-2)
                    .attr("y", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("alignment-baseline", "middle")
                    .style("fill", "black")
                    .style("opacity", 0)
                    .text(numeral(d.entitycount/thisvis.data.size).format("0%"))
                    .transition().delay(750).duration(500)
                        .style("opacity", 1);
                this.svg.select("#eoyaxis").insert("text", ":first-child")
                    .attr("class", "childlabel_ancestors")
                    .attr("x", this.eoX(100)-2)
                    .attr("y", 2)
                    .attr("alignment-baseline", "hanging")
                    .attr("text-anchor", "end")
                    .style("fill", "black")
                    .style("opacity", 0)
                    .text("Supertypes")
                    .transition().delay(750).duration(500)
                        .style("opacity", (parent_ids.length < 1 ? 0.0 : 1.0));
                this.svg.select("#eoyaxis").insert("text", ":first-child")
                    .attr("class", "childlabel_children")
                    .attr("x", this.eoX(100)-2)
                    .attr("y", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED+2)
                    .attr("alignment-baseline", "hanging")
                    .attr("text-anchor", "end")
                    .style("fill", "black")
                    .style("opacity", 0)
                    .text("Child Types")
                    .transition().delay(750).duration(500)
                    .style("opacity", 1);
                this.svg.select("#eoyaxis").insert("line", ":first-child")
                    .attr("class", "childlegline")
                    .attr("x1", this.eoX(d.corr))
                    .attr("x2", this.eoX(d.corr))
                    .attr("y1", y_position)
                    .attr("y2", this.eoY(0))
                    .style("stroke-opacity", 0)
                    .style("stroke", color(d.corr))
                    .style("stroke-width", 0.25)
                    .style("stroke-dasharray","4 2")
                    .transition().delay(750).duration(500)
                    .style("stroke-opacity", 1);
                this.svg.select("#eoyaxis").insert("line", ":first-child")
                    .attr("class", "childzeroline")
                    .attr("x1", this.eoX(0))
                    .attr("x2", this.eoX(0))
                    .attr("y1", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", this.eoY(0))
                    .style("stroke-opacity", 0)
                    .style("stroke", this.outline_color)
                    .style("stroke-width", 0.25)
                    .transition().delay(750).duration(500)
                    .style("stroke-opacity", 1);
                this.svg.select("#eoyaxis").selectAll(".childsideline").data([-100,100]).enter().insert("line", ":first-child")
                    .attr("class", "childsideline")
                    .attr("x1", function(d) { return thisvis.eoX(d); })
                    .attr("x2", function(d) { return thisvis.eoX(d); })
                    .attr("y1", y_position + 1*this.PARENT_SPACING_WHEN_OPTIMIZED)
                    .attr("y2", this.eoY(0))
                    .style("stroke-opacity", 0)
                    .style("stroke", this.outline_color)
                    .style("stroke-width", 0.5)
                    .transition().delay(750).duration(500)
                    .style("stroke-opacity", 1);
            }

            // Display annotations on scatter plot.
            this.showAnnotations(d.id, d.child_ids, parent_ids, d.corr);

            moused_element.raise();

            thisvis.focused_data = d;
        }

        updateCorrelationColormapRange(min, max) {
            this.color_map_min = this.COLOR_MAP_MIN_LIMIT + min*(this.COLOR_MAP_MAX_LIMIT - this.COLOR_MAP_MIN_LIMIT);
            this.color_map_max = this.COLOR_MAP_MIN_LIMIT + max*(this.COLOR_MAP_MAX_LIMIT - this.COLOR_MAP_MIN_LIMIT);
            this.render();
        }

        setSearchByClick(d) {
            clearTimeout(this.clickTimeout);
            if (d3.event != null) {
                d3.event.stopPropagation();
            }
            this.clickTimeout = setTimeout(lang.hitch(this, this.setSearchByClickHelper), 300, d);
        }

        setSearchByClickHelper(d) {
            let thisvis = this;
            //console.log("SET SEARCH BOX TO " + d.label + " TO HIGHLIGHT CLICKED NODE BLUE.");
            dom.byId(this.search_container_id).value = d.code + ": " + d.label;
            thisvis.removeFocusHelper();
            thisvis.search_focus = d;
            thisvis.last_searched_id = d.id;
            thisvis.render();
        }

        setOption(parameter, value) {
            if (parameter === 'child_arcs') {
                this.draw_child_arcs = value;
            }

        }
    }
});
