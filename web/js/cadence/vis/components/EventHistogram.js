"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/aspect"
], (declare, lang, registry, Menu, MenuItem, aspect) => {
    return class {
        constructor(container) {
            let this_vis = this;
            this.container = container;
            this.tableID = cadence.uidGenerator();
            this.container.innerHTML = "<table style='border-collapse: collapse; font-size: 6pt' id='"+this.tableID+"'><tr>" +
                "<th>Code</th><th>Description</th>" +
                "<th>Occurrences</th><th>Patients</th>" + "<th>Correlation</th>" +
                "</tr></table><div style='text-align: middle; font-style: italic; font-size: 6pt;'>Only the top 100 events are displayed.</div>";

            // Add event handlers for click events on each column.
            d3.select('#'+this.tableID).select("tr").selectAll("th")
                .data(['code','label','totalcount','entitycount' ,'corr'])
                .style("cursor", "ns-resize")
                .on('click', function(d) {
                    this_vis.render(d);
                });

            // Create a dispatcher to handle events that bubble outside of the histogram.
            this.dispatcher = d3.dispatch("filter","milestone","brush");

            // Create the context menu.
            this.contextMenu = new Menu({
                targetNodeIds: [this.tableID],
                selector: 'td'
            });
            /*
            this.filterMenuItem = new MenuItem({
                label: "Filter...",
                onClick: function(e){
                    var node = this.getParent().currentTarget;
                    var args = { type: node.__data__ };

                    this_vis.dispatcher.call("filter", this_vis, args);
                }
            });
            this.contextMenu.addChild(this.filterMenuItem);
            */
            this.milestoneMenuItem = new MenuItem({
                label: "Add as milestone...",
                onClick: function(e){
                    var node = this.getParent().currentTarget;
                    var args = { type: node.__data__ };

                    this_vis.dispatcher.call("milestone", this_vis, args);
                }
            });
            this.contextMenu.addChild(this.milestoneMenuItem);
        }

        on(event_name, event_handler) {
            this.dispatcher.on(event_name, event_handler);
        }

        init(init_data) {
            // Get a filtered copy of the data to include only those with frequency data.
            this.data = Object.values(init_data).filter(function(d) {
                return d.totalcount === undefined ? false : true;
            });

            // Also filter out to only include events that are marked as being informative.
            this.data = Object.values(this.data).filter(function(d) {
                return d.informative;
            });

            this.render(null);
        }

        render(sort_mode) {
            let this_vis = this;

            // Sort the data by the requested mode.
            if ((sort_mode === null) || (sort_mode === 'totalcount')) {
                this.data.sort(function (a, b) {
                    return b.totalcount - a.totalcount;
                });
                // Get the max total count (used to scale histograms). This will happen the first time because
                // we sort by frequency by default the first time we render.
                this.maxCount = this.data.length > 0 ? this.data[0].totalcount : 0;
            }
            else if (sort_mode === 'entitycount') {
                this.data.sort(function (a, b) {
                    return b.entitycount - a.entitycount;
                });
            }
            else if (sort_mode === 'corr') {
                this.data.sort(function (a, b) {
                    return Math.abs(b.corr) - Math.abs(a.corr);
                });
            }
            else if (sort_mode === 'code') {
                this.data.sort(function (a, b) {
                    let a_code = a.cat + "-" + a.code;
                    let b_code = b.cat + "-" + b.code;
                    return a_code.localeCompare(b_code);
                });
            }
            else if (sort_mode === 'label') {
                this.data.sort(function (a, b) {
                    return a.label.localeCompare(b.label);
                });
            }
            let max_count = this.maxCount;


            // Get the table and remove any old rows.
            let table = d3.select('#'+this.tableID);
            table.selectAll(".datarow").remove();

            // Append new rows for the sorted data
            let rows = table.selectAll(".datarow").data(this.data.slice(0,100));

            let new_rows = rows.enter().append("tr").attr('class', 'datarow');

            new_rows.on("mouseover", function(d,i) {
                    d3.select(this).style("background-color", "#eeeeee")
                    this_vis.dispatcher.call("brush", this_vis, {cat: d.cat, code: d.code, label: d.label});
                })
                .on("mouseout", function(d,i) {
                    d3.select(this).style("background-color", "#ffffff")
                    this_vis.dispatcher.call("brush", this_vis, null);
                });


            new_rows.append('td')
                /*
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                */
                .html(function(d) { return d.cat + "-" + d.code});

            new_rows.append('td')
                /*
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                */
                .html(function(d) { return d.label});

            new_rows.append('td')
                /*
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                */
                .html(function(d) {
                    let width = Math.max(1,40 * (d.totalcount / max_count));
                    return "<div oncontextmenu=\"return false;\" class='cad-histbar' style='height: 8px; width: "+width+"px;'></div>"+numeral(d.totalcount).format('0,0');
                });

            new_rows.append('td')
                /*
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                */
                .html(function(d) {
                    let width = Math.max(1,40 * (d.entitycount / max_count));
                    return "<div oncontextmenu=\"return false;\" class='cad-histbar' style='height: 8px; width: "+width+"px;'></div>"+numeral(d.entitycount).format('0,0');
                });
            new_rows.append('td')
                /*
                .on("contextmenu", function(d,i) {
                    // Enable the appropriate options for this item.
                    this_vis.filterMenuItem.set('disabled', false);
                })
                */
                .html(function(d) {
                    let width = Math.abs(d.corr)*100; return "<div oncontextmenu=\"return false;\" class='cad-histbar' style='height: 8px; width: "+width+"px;'></div>"+numeral(d.corr).format('0,0.00');
                });
        }
    }
});
