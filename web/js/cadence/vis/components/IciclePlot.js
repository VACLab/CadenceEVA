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
            this.selectedEvent = null;

            // Threshold
            this.gradientThreshold = 1;

            // Options
            this.compressionType = "breadth";
            this.collapseType = "gradientInOut";

            this.rowHeight = 10;

            // Symbol for constraints
            this.symbol = d3.symbol()
                .type(d3.symbolDiamond)
                .size(20);

            // Color
            this.highlightColor = "black";
            this.connectionColor = "black";
            this.borderColor = null;
            this.colorScale = d3.scaleLinear()
                .range(["#999", "#b2182b"])
                .clamp(true);

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.containerHeight = parseInt(cs.height, 10);
            this.height = this.containerHeight;

            // Margins
            this.margin = { top: 4, left: 4, bottom: 4, right: 4 };
            this.innerWidth = function() { return this.width - this.margin.left - this.margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - this.margin.top - this.margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .on("click", function() {
                    self.dispatcher.call("select", this, null);
                })
                .on("mouseenter", function() {
                    self.expand(null);
                })
                .on("mouseleave", function() {
                    self.expand(null);
                });

            // Drop shadow filter
            this.svg.append("defs").append("filter")
                .attr("id", "icicleShadow")
                .attr("width", "200%")
                .attr("height", "200%")
              .append("feDropShadow")
                .attr("dx", 4)
                .attr("dy", 4)
                .attr("stdDeviation", 4);

            // Apply margins
            let g = this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

            // Create groups for rendering layers
            g.append("g").attr("class", "events");
            g.append("g").attr("class", "connections");
            g.append("g").attr("class", "expand");

            // Tooltip
            let numberFormat = d3.format(".3f");

            this.tip = d3.tip()
                .attr("class", "d3-tip")
                .direction("e")
                .offset(function(d) {
                    const h = this.getBBox().height,
                        y1 = +d3.select(this).attr("y"),
                        y2 = d3.mouse(g.node())[1];

                    return [-h / 2 - y1 + y2, 5];
                })
                .html(function (d) {
                    const data = d.data.node ? d.data.node.data :
                        d.data.nodes ? d.data.nodes[0].data :
                        d.data;

                    const constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

                    return "<div>" + data.code + ": " + data.label + "</div>" +
                        (constraints.indexOf(data.id) !== -1 ? "<div>♦ : Constraint</div>" : "") +
                        "<hr>" +
                        "<div>Distance: " + numberFormat(data.distance) + "</div>" +
                        "<div>Gradient: " + numberFormat(data.gradient) + "</div>";
                });

            this.svg.call(this.tip);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.containerHeight = height;

            // Update the SVG element
            this.svg
                .attr("width", this.width);

            this.svg.select(".compressionButton")
                .attr("x", this.width - 21);

            // Trigger a re-render
            this.render();
        }

        init(init_data) {
            // Store a reference to the data.
            this.data = init_data;

            this.processData();
            this.render();
        }

        update(update_data) {
            // Store a reference to the data
            this.data = update_data;

            this.processData();
            this.render();
        }

        selectEvent(event) {
            // Need to re-render if current or new event is collapsible
            let reRender =
                (this.selectedEvent && this.selectedEvent.gradientMag < this.gradientThreshold) ||
                (event && event.gradientMag < this.gradientThreshold);

            this.selectedEvent = event;

            if (reRender) {
                this.processData();
                this.render();
            }
            else {
                this.highlight(null);
            }

            if (event) {
                // Scroll to first selected if not visible
                let selectedNodes = [];
                this.svg.select(".events").selectAll(".event").select("rect").each(function(d) {
                    if (d.data.node && d.data.node.data === event) {
                        selectedNodes.push(this);
                    }
                });

                // XXX: This shouldn't be necessary, as the selected event should now be rendered...
                if (selectedNodes.length === 0) return;

                let inView = selectedNodes.filter(function (d) {
                    return isInViewport(d);
                });

                if (inView.length === 0) {
                    selectedNodes[0].scrollIntoView({behavior: "auto", block: "center"});
                }
            }

            function isInViewport(node) {
                let bb = node.getBoundingClientRect();

                return (
                    bb.top >= 0 &&
                    bb.left >= 0 &&
                    bb.bottom <= window.innerHeight &&
                    bb.right <= window.innerWidth
                );
            }
        }

        setGradientThreshold(threshold) {
            this.gradientThreshold = threshold;

            console.log(threshold);

            this.processData();
            this.render();

            this.expand(null);
        }

        setOption(parameter, value) {
            let self = this;

            switch (parameter) {
                case "compressionType":
                    setCompressionType(value);
                    break;

                case "collapseType":
                    setCollapseType(value);
                    break;

                default:
                    console.log("Unknown parameter: " + parameter);
            }

            function setCompressionType(value) {
                switch (value) {
                    case "breadth":
                    case "depth":
                        self.compressionType = value;

                        console.log("Compression type: " + value);

                        self.processData();
                        self.render();

                        break;

                    default:
                        console.log("Invalid compression type value: " + value);
                }
            }

            function setCollapseType(value) {
                switch (value) {
                    case "gradientIn":
                    case "gradientMagIn":
                    case "gradientInOut":
                        self.collapseType = value;

                        self.processData();
                        self.render();

                        break;

                    default:
                        console.log("Invalid collapse type value: " + value);
                }
            }
        }

        processData() {
            let self = this;

            let root = this.data.root;

            console.log("===== COMPRESS HIERARCHY =====");
            console.log(self.data.root.data.cat);
            console.log("Original node count: " + root.descendants().length);

            // Split into rows for each leaf node
            let rows = root.leaves().map(function(row) {
                let rootPath = row.ancestors().slice().reverse();

                return {
                    rootPath: rootPath,
                    pathByDistance: rootPath.slice().sort(function(a, b) {
                        let g1 = a.data.distance,
                            g2 = b.data.distance;

                        return g1 === g2 ? d3.ascending(a.depth, b.depth) : d3.descending(g1, g2);
                    })
                };
            });

            console.log("Uncompressed node count: " + d3.sum(rows, function(d) {
                return d.rootPath.length;
            }));

            // Sort rows by ancestral distance
            rows.sort(function(a, b) {
                let aPath = a.pathByDistance,
                    bPath = b.pathByDistance;

                // Get number of distances in common
                let n = Math.min(aPath.length, bPath.length);

                // Sort by maximum distance
                for (let i = 0; i < n; i++) {
                    let d1 = aPath[i].data.distance,
                        d2 = bPath[i].data.distance;

                    if (d1 === d2) {
                        continue;
                    }

                    return d3.descending(d1, d2);
                }

                // All distances the same, sort by depth, then code
                return aPath.length === bPath.length ?
                    d3.ascending(a.rootPath[n - 1].data.code, b.rootPath[n - 1].data.code) :
                    d3.descending(aPath.length, bPath.length);
            });

            // Compress
            let newRoot = this.compressionType === "breadth" ?
                compressDataByBreadth(root, rows) : compressDataByDepth(root, rows);

            // Finish processing groups for collapsed nodes
            newRoot.descendants().filter(function(d) {
                return !d.data.node;
            }).forEach(function(d) {
                let nodes = d.data.nodes;

                d.data.minDistance = d3.min(nodes, function(d) {
                    return d.data.distance;
                });

                d.data.maxDistance = d3.max(nodes, function(d) {
                    return d.data.distance;
                });

                d.data.meanDistance = d3.mean(nodes, function(d) {
                    return d.data.distance;
                });

                d.data.depthExtent = d3.extent(nodes, function(d) {
                    return d.depth;
                });
            });

            this.compressedRoot = newRoot;

            function collapsible(node) {
                switch (self.collapseType) {
                    case "gradientIn":
                        return !(node.data.gradient >= self.gradientThreshold || node.data === self.selectedEvent);

                    case "gradientMagIn":
                        return !(node.data.gradientMag >= self.gradientThreshold || node.data === self.selectedEvent);

                    case "gradientInOut":
                        return !(node.data.gradient >= self.gradientThreshold ||
                            (node.children && node.children.reduce((p, c) => p || c.data.gradient <= -self.gradientThreshold, false)) ||
                            node.data === self.selectedEvent);
                }
            }

            function compressDataByDepth(root, rows) {
                let groups = [],
                    mergeBuffer = d3.range(root.height + 1).map(function(d) {
                        return null;
                    }),
                    endGroup = null;

                rows.forEach(function(row) {
                    let parentId = null,
                        collapsed = [];

                    row.rootPath.forEach(function(node, i) {
                        let group = mergeBuffer[i];

                        if (!collapsible(node) || i === 0) {
                            // Add any accumulated collapsed nodes
                            if (collapsed.length > 0) {
                                handleCollapsed(i);
                            }

                            if (group && node === group.node) {
                                parentId = group.id;
                            }
                            else {
                                // Create new group for this node
                                let id = groups.length;

                                let newGroup = {
                                    id: id,
                                    parentId: parentId,
                                    node: node
                                };

                                mergeBuffer[i] = newGroup;
                                groups.push(newGroup);

                                parentId = id;
                                collapsed = [];

                                // Clear remaining groups in merge buffer
                                for (let j = i + 1; j < mergeBuffer.length; j++) {
                                    mergeBuffer[j] = null;
                                }
                            }
                        }
                        else {
                            if (group && group.node) {
                                // Clear remaining groups in merge buffer
                                for (let j = i; j < mergeBuffer.length; j++) {
                                    mergeBuffer[j] = null;
                                }
                            }

                            collapsed.push(node);
                        }
                    });

                    // Handle any collapsed nodes at the end
                    if (collapsed.length > 0) {
                        if (endGroup &&
                            (parentId === endGroup.parentId || endGroup.nodes[0].id === collapsed[0].id)) {
                            collapsed.forEach(function (d) {
                                let nodes = endGroup.nodes;

                                if (nodes.indexOf(d) === -1) nodes.push(d);
                            });

                            collapsed = [];
                        }
                        else {
                            // Create new group for collapsed nodes
                            let id = groups.length;

                            // Create new group
                            let newGroup = {
                                id: id,
                                parentId: parentId,
                                nodes: collapsed
                            };

                            endGroup = newGroup;
                            groups.push(newGroup);

                            collapsed = [];
                        }
                    }

                    function handleCollapsed(i) {
                        if (mergeBuffer[i - 1] && mergeBuffer[i - 1].nodes) {
                            // Add to previous merge buffer group, which should hold collapsed nodes
                            let collapsedGroup = mergeBuffer[i - 1];

                            collapsed.forEach(function(d) {
                                let nodes = collapsedGroup.nodes;

                                if (nodes.indexOf(d) === -1) nodes.push(d);
                            });

                            parentId = collapsedGroup.id;
                            collapsed = [];
                        }
                        else {
                            // Create new group for collapsed nodes
                            let id = groups.length;

                            // Create new group
                            let newGroup = {
                                id: id,
                                parentId: parentId,
                                nodes: collapsed
                            };

                            mergeBuffer[i - 1] = newGroup;
                            groups.push(newGroup);

                            parentId = id;
                            collapsed = [];
                        }
                    }
                });

                // Fix root node
                groups[0].nodes = [groups[0].node];
                delete groups[0].node;

                if (groups.length === 2) {
                    groups[0].nodes = groups[0].nodes.concat(groups[1].nodes);
                    groups.pop();
                }

                let newRoot = d3.stratify()
                    .id(function(d) { return d.id; })
                    .parentId(function(d) { return d.parentId; })
                    (groups);

                console.log("Compressed node count: " + newRoot.descendants().length);

                return newRoot;
            }

            function compressDataByBreadth(root, rows) {
                // Create groups for compressing
                let groups = [];

                // First compress by breadth
                for (let i = 0; i <= root.height; i++) {
                    rows.forEach(function(row, j) {
                        if (i >= row.rootPath.length) return;

                        let node = row.rootPath[i];

                        if (j === 0) {
                            // Create new group for this node
                            createGroup();
                        }
                        else {
                            let prevRow = rows[j - 1];

                            if (i >= prevRow.rootPath.length) {
                                // Create new group for this node
                                createGroup();
                            }
                            else {
                                // Get group from previous row
                                let group = prevRow.rootPath[i];

                                if (node === group.node) {
                                    // Use existing group
                                    row.rootPath[i] = group;
                                }
                                else {
                                    // Create new group for this node
                                    createGroup();
                                }
                            }
                        }

                        function createGroup() {
                            let id = groups.length;

                            let newGroup = {
                                id: id,
                                parentId: i === 0 ? null : row.rootPath[i - 1].id,
                                node: node,
                                anchor: false
                            };

                            groups.push(newGroup);
                            row.rootPath[i] = newGroup;
                        }
                    });
                }

                // Create intermediate tree
                let tempRoot = d3.stratify()
                    .id(function(d) { return d.id; })
                    .parentId(function(d) { return d.parentId; })
                    (groups);

                // Find anchor groups
                tempRoot.eachAfter(function(d) {
                    let isCollapsible = collapsible(d.data.node);

                    if (!isCollapsible) d.data.anchor = false;

                    if (d.parent) d.parent.data.anchor = d.parent.data.anchor || !isCollapsible || d.data.anchor;
                });

                // Now compress by depth
                groups = [];

                tempRoot.eachBefore(function(d) {
                    if (!d.children) return;

                    let parentNode = d.data.node,
                        parentGroup = null;

                    parentGroup = d.data.group ? d.data.group :
                        createGroup(d.data, collapsible(parentNode));

                    if (!d.data.anchor && parentGroup.nodes) {
                        // Add all children to the parent group
                        d.children.forEach(function(d) {
                            let node = d.data.node,
                                nodes = parentGroup.nodes;

                            if (nodes.indexOf(node) === -1) nodes.push(node);

                            d.data.group = parentGroup;
                        });
                    }
                    else if (d.data.anchor && d.children.length === 1) {
                        let child = d.children[0];

                        if (child.data.anchor) {
                            let node = child.data.node,
                                nodes = parentGroup.nodes;

                            if (!nodes) {
                                console.log("Warning, parent group doesn't have nodes.");
                                console.log(d);
                            }

                            if (nodes.indexOf(node) === -1) nodes.push(node);

                            child.data.group = parentGroup;
                        }
                        else {
                            // Should be non-collapsible
                            if (collapsible(child.data.node)) {
                                console.log("Warning, child should not be collapsible");
                            }

                            createGroup(child.data, false);
                        }
                    }
                    else {
                        let currentGroup = null;

                        d.children.forEach(function(d) {
                            let node = d.data.node;

                            if (!collapsible(node)) {
                               createGroup(d.data, false);
                               currentGroup = null;
                            }
                            else if (d.data.anchor) {
                                createGroup(d.data, true);
                                currentGroup = null;
                            }
                            else {
                                if (!currentGroup) {
                                    currentGroup = createGroup(d.data, true);
                                }
                                else {
                                    let nodes = currentGroup.nodes;

                                    if (nodes.indexOf(node) === -1) nodes.push(node);

                                    d.data.group = currentGroup;
                                }
                            }
                        });
                    }

                    function createGroup(data, collapse) {
                        let id = groups.length;

                        let newGroup = {
                            id: id,
                            parentId: parentGroup ? parentGroup.id : null
                        };

                        if (collapse) {
                            newGroup.nodes = [data.node];
                        }
                        else {
                            newGroup.node = data.node;
                        }

                        groups.push(newGroup);
                        data.group = newGroup;

                        return newGroup;
                    }
                });

                // Create final compressed tree
                let newRoot = d3.stratify()
                    .id(function(d) { return d.id; })
                    .parentId(function(d) { return d.parentId; })
                    (groups);

                console.log("Compressed node count: " + newRoot.descendants().length);

                return newRoot;
            }
        }

        // The render function, which should update all elements of this visualization.
        render() {
            if (!this.compressedRoot) return;

            let self = this;

            let root = this.data.root;
            let range = this.data.range;
            let constraints = self.data.constraints.filter(d => d.id).map(d => d.id);

            // TODO: Switch to a d3 scheme chromatic color map?
            // TODO: Share color map across visualizations.
            this.colorScale.domain([0, range.maxNonConstraintDistance]);

            this.borderColor = d3.color(this.colorScale(0)).brighter(0.5);

            // Compute height
            this.height = Math.max(this.compressedRoot.leaves().length * this.rowHeight + this.margin.top + this.margin.bottom, this.containerHeight);
            this.svg.attr("height", this.height);

            let columnScale = d3.scaleBand()
                .domain(d3.range(0, root.height + 1))
                .range([0, this.innerWidth()]);

            // Create icicle plot
            this.compressedRoot.count();

            d3.partition()
                .size([this.innerHeight(), this.innerWidth()])
                .round(true)
                (this.compressedRoot);

            // Bind data
            let event = this.svg.select(".events").selectAll(".event")
                .data(this.compressedRoot.descendants());

            // Enter
            let eventEnter = event.enter().append("g")
                .attr("class", "event");

            eventEnter.append("rect")
                .attr("rx", 3)
                .attr("ry", 3)
                .on("mouseover", function(d) {
                    if (!collapsed(d)) {
                        self.tip.show.call(this, d);
                        self.highlight(d.data.node.data);
                        self.expand(null);
                    }
                    else {
                        self.expand(d3.select(this));
                    }
                })
                .on("mouseout", function(d) {
                    d3.event.stopPropagation();

                    if (!collapsed(d)) {
                        self.tip.hide();
                        self.highlight(null);
                    }
                })
                .on("click", function(d) {
                    d3.event.stopPropagation();

                    if (!collapsed(d)) {
                        self.dispatcher.call("select", this, d.data.node.data);
                    }
                });

            // Enter + update
            eventEnter.merge(event).each(function(d) {
                let g = d3.select(this);

                const rx = x(d);
                const ry = y(d);
                const rw = width(d);
                const rh = height(d);

                // Update rect
                g.select("rect")
                    .attr("x", rx)
                    .attr("y", ry)
                    .attr("width", rw)
                    .attr("height", rh)
                    .style("fill", fill)
                    .style("stroke", stroke)
                    .style("stroke-width", 1);

                // Update constraint
                let events = d.data.node ? [d.data.node.data] : d.data.nodes.map(function(d) {
                    return d.data;
                });

                let constrained = events.reduce(function(p, c) {
                    return p || constraints.indexOf(c.id) !== -1;
                }, false);

                let constraint = g.selectAll(".constraint")
                    .data(constrained ? [d] : []);

                constraint.enter().append("path")
                    .attr("class", "constraint")
                    .attr("d", self.symbol)
                    .style("pointer-events", "none")
                    .style("fill", "black")
                  .merge(constraint)
                    .attr("transform", "translate(" + (rx + rw / 2) + "," + (ry + rh / 2) + ")");

                constraint.exit().remove();
            })
            .sort(function(a, b) {
                return collapsed(a) ? -1 : 1;
            });

            // Exit
            event.exit().remove();

            self.highlight(null);

            function collapsed(d) {
                return !d.data.node;
            }

            function x(d) {
                return collapsed(d) ?
                    columnScale(d.data.depthExtent[0]) :
                    columnScale(d.data.node.depth);
            }

            function y(d) {
                let y = d.x0;

                return collapsed(d) ? y + self.rowHeight / 4 : y;
            }

            function width(d) {
                return collapsed(d) ?
                    (d.data.depthExtent[1] - d.data.depthExtent[0] + 1) * columnScale.bandwidth() :
                    columnScale.bandwidth();
            }

            function height(d) {
                let h = d.x1 - d.x0;

                return collapsed(d) ? h - self.rowHeight / 2 : h;
            }

            function fill(d) {
                return collapsed(d) ?
                    self.colorScale(d.data.maxDistance) :
                    self.colorScale(d.data.node.data.distance);
            }

            function stroke(d) {
                return collapsed(d) ? this.borderColor : "black";
            }
        }

        highlight(d) {
            let self = this;

            let events = [];
            if (d) events.push(d);
            if (self.selectedEvent) events.push(self.selectedEvent);

            this.svg.select(".events").selectAll(".event")
                .filter(function(d) {
                    return d.data.node;
                })
                .each(function(d) {
                    let h = highlightEvent(d.data.node.data);

                    d3.select(this).select("rect")
                        .style("stroke", h ? self.highlightColor : "black")
                        .style("stroke-width", h ? 3 : self.gradientThreshold > 0 ? 1 : 0.5);
                })
                .filter(function(d) {
                    return highlightEvent(d.data.node.data);
                }).raise();

            function highlightEvent(d) {
               return events.indexOf(d) !== -1;
            }

            // Event connections

            // Curve
            let curve = function(d) {
                let x1 = d[0].x1,
                    y1 = d[0].y2,
                    y2 = d[1].y1,
                    x = x1 - (d[0].x2 - x1) / 2,
                    y = y1 + (y2 - y1) / 2;

                return  "M" + x1 + " " + y1 +
                        "Q" + x + " " + y + ", " + x1 + " " + y2;
            };

            let curveElbow = function(d) {
                let w = (d[0].x2 - d[0].x1);
                let x = w / 2;
                let r = w / 2;

                return  "M" + d[0].x1 + " " + d[0].yMid +
                        "H" + (x + r) +
                        "q" + (-r) + " 0," + (-r) + " " + r +
                        "V" + (d[1].yMid - r) +
                        "q0 " + r + "," + r + " " + r +
                        "H" + (d[1].x1);
            };

            // Bind data for each event
            let event = self.svg.select(".connections").selectAll(".connection")
                .data(events);

            // Enter + update
            event.enter().append("g")
                .attr("class", "connection")
              .merge(event)
                .each(function(d) {
                    let nodes = self.svg.selectAll(".event").filter(function(e) {
                        if (e.data.node) {
                            return e.data.node.data === d;
                        }
                        else {
                            return e.data === d;
                        }
                    });

                    nodes = nodes.nodes().map(function(d) {
                        let n = d3.select(d).select("rect");

                        let x = +n.attr("x");
                        let y = +n.attr("y");
                        let w = +n.attr("width");
                        let h = +n.attr("height");

                        return {
                            x1: x,
                            x2: x + w,
                            y1: y,
                            y2: y + h,
                            xMid: x + w / 2,
                            yMid: y + h / 2
                        };
                    });

                    nodes.sort(function(a, b) {
                       return d3.ascending(a.y1, b.y1);
                    });

                    let pairs = d3.pairs(nodes);
                    let points = pairs.map(function(d) {
                        let x1 = d[0].x1,
                            y1 = d[0].y2,
                            y2 = d[1].y1,
                            x = x1 - (d[0].x2 - x1) / 2,
                            y = y1 + (y2 - y1) / 2;

                        return [
                            { x: x1, y: y1 },
                            { x: x, y: y },
                            { x: x1, y: y2 }
                        ];
                    });

                    // Bind node pairs for connections
                    let path = d3.select(this).selectAll("path")
                        .data(pairs);

                    // Enter + update
                    path.enter().append("path")
                        .style("fill", "none")
                        .style("stroke", self.connectionColor)
                        .style("stroke-width", 2)
                        .style("stroke-dasharray", "3 3")
                      .merge(path)
                        .attr("d", curveElbow);

                    // Exit
                    path.exit().remove();
                });

            // Exit
            event.exit().remove();

            function doHighlight(e) {
                if (e.data.node) {
                    return e.data.node.data === d || e.data.node.data === self.selectedEvent;
                }
                else {
                    let events = e.data.nodes.map(function(d) {
                        return d.data;
                    });

                    return events.indexOf(d) !== -1 || events.indexOf(self.selectedEvent) !== -1;
                }
            }
        }

        expand(selection) {
            let self = this;

            let constraints = self.data.constraints.map(function(d) {
                return d.id;
            });

            let selections = [];
            if (selection) selections.push(selection);

            let group = this.svg.select(".expand").selectAll(".group")
                .data(selections);

            group.enter().append("g")
                .attr("class", "group")
                .on("mouseleave", function(d) {
                    self.expand(null);
                    self.highlight(null);
                })
                .each(function(d) {
                    let node = d3.select(this);

                    node.append("rect")
                        .attr("class", "backdrop")
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("fill", "white")
                        .style("fill-opacity", 0.8)
                        .style("filter", "url(#icicleShadow)");

                    node.append("g").attr("class", "events");

                    node.append("rect")
                        .attr("class", "border")
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("fill", "none")
                        .style("stroke", "black")
                        .style("stroke-width", 2);
                })
              .merge(group)
                .each(function(d) {
                    let g = d3.select(this);

                    let x = +d.attr("x");
                    let y = +d.attr("y");
                    let w = +d.attr("width");
                    let h = +d.attr("height");

                    let events = d.datum().data.nodes.map(function(d) {
                        return d.data;
                    });

                    let root = null;

                    let dummyRoot = false;

                    if (events[0].parent_id) {
                        let rootEvent = {
                            id: events[0].parent_id,
                            parent_id: null
                        };

                        events.push(rootEvent);

                        dummyRoot = true;

                        root = d3.stratify()
                            .id(function(d) { return d.id; })
                            .parentId(function(d) { return d.parent_id; })
                            (events);
                    }
                    else {
                        root = d3.stratify()
                            .id(function(d) { return d.id; })
                            .parentId(function(d) { return d.parent_id; })
                            (events);
                    }

                    root.count();

                    // Compute width
                    let nodeWidth = w / (Math.max(root.height, 1));
                    let partitionX = x - (dummyRoot ? nodeWidth : 0);
                    let partitionWidth = w + (dummyRoot ? nodeWidth : 0);

                    // Compute height
                    let numLeaves = root.leaves().length;
                    let nodeHeight = Math.max(h / numLeaves, 10);
                    let partitionHeight = nodeHeight * numLeaves;
                    let partitionY = y - (partitionHeight - h ) / 2;

                    // Make sure it fits vertically
                    let container = dom.byId(self.containerID);
                    let top = container.scrollTop;
                    let height = container.offsetHeight - self.margin.top - self.margin.bottom;
                    let bottom = top + height;

                    if (partitionHeight > height) partitionHeight = height;
                    if (partitionY < top) partitionY = top;
                    if (partitionY + partitionHeight > bottom) partitionY = bottom - partitionHeight;

                    nodeHeight = partitionHeight / numLeaves;

                    let icicles = d3.partition()
                        .size([partitionHeight, partitionWidth])
                        (root);

                    // Bind data for icicles
                    let event = g.select(".events").selectAll(".event")
                        .data(dummyRoot ? root.descendants().slice(1) : root.descendants());

                    // Enter
                    let eventEnter = event.enter().append("g")
                        .attr("class", "event");

                    eventEnter.append("rect")
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .on("mouseover", function(d) {
                            self.tip.show.call(this, d);

                            d3.select(this)
                                .style("stroke", self.highlightColor)
                                .style("stroke-width", 2);

                            d3.select(this.parentNode).raise();
                        })
                        .on("mouseout", function() {
                            self.tip.hide();

                            d3.select(this)
                                .style("stroke", self.borderColor)
                                .style("stroke-width", 1);
                        })
                        .on("click", function(d) {
                            d3.event.stopPropagation();

                            self.tip.hide();

                            self.expand(null);

                            self.dispatcher.call("select", this, d.data);
                        });

                    // Enter + update
                    eventEnter.merge(event).each(function(d) {
                        let g = d3.select(this);

                        const rx = partitionX + d.y0;
                        const ry = partitionY + d.x0;
                        const rw = d.y1 - d.y0;
                        const rh = d.x1 - d.x0;

                        // Update rect
                        g.select("rect")
                            .attr("x", function (d) {
                                return partitionX + d.y0;
                            })
                            .attr("y", function (d) {
                                return partitionY + d.x0;
                            })
                            .attr("width", function (d) {
                                return d.y1 - d.y0;
                            })
                            .attr("height", function (d) {
                                return d.x1 - d.x0;
                            })
                            .style("fill", function (d) {
                                return self.colorScale(d.data.distance);
                            })
                            .style("stroke", nodeHeight >= 2 ? self.borderColor : "none");

                        // Update constraint
                        let constrained = constraints.indexOf(d.data.id) !== -1;

                        let constraint = g.selectAll(".constraint")
                            .data(constrained ? [d] : []);

                        constraint.enter().append("path")
                            .attr("class", "constraint")
                            .attr("d", self.symbol)
                            .style("pointer-events", "none")
                            .style("fill", "black")
                          .merge(constraint)
                            .attr("transform", "translate(" + (rx + rw / 2) + "," + (ry + rh / 2) + ")");

                        constraint.exit().remove();
                    });

                    // Exit
                    event.exit().remove();

                    // Background and border
                    g.select(".backdrop")
                        .attr("x", x)
                        .attr("y", partitionY)
                        .attr("width", w)
                        .attr("height", partitionHeight)
                        .style("visibility", "visible");

                    g.select(".border")
                        .attr("x", x)
                        .attr("y", partitionY)
                        .attr("width", w)
                        .attr("height", partitionHeight)
                        .style("visibility", "visible");
                });

            // Exit
            group.exit().remove();
        }
    }
})
