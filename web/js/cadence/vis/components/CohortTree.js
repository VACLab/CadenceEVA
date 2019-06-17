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
    "dojo/query",
    "dojo/aspect",
    "vaclab/VaclabVis",
    "cadence/vis/components/CohortNode"
], (declare, lang, dom, domStyle, dojoOn, registry, Menu, MenuItem, query, aspect, VaclabVis, CohortNode) => {
    return class extends VaclabVis {

        constructor(dom_container_id) {
            super(dom_container_id, ["baseline", "focus", "showTimeline"]);

            let self = this;

            this.baseline = null;

            // Store the container ID.
            this.containerID = dom_container_id;

            // Drift type
            this.driftType = "baseline";

            // Highlight tooltips
            this.showBaselineTooltip = false;
            this.showFocusTooltip = false;

            // Get initial SVG size.
            let container = dom.byId(this.containerID);
            let cs = domStyle.getComputedStyle(container);
            this.width = parseInt(cs.width, 10);
            this.height = parseInt(cs.height, 10);

            // Cohort node function
            this.cohortNode = CohortNode();

            // Margin calculation based on node size
            let m = this.cohortNode.radius() * 1.5;

            // TODO: Move margin and inner width/height to VaclabVis?
            let margin = { top: m, left: m, bottom: m, right: m };
            this.innerWidth = function() { return this.width - margin.left - margin.right; }.bind(this);
            this.innerHeight = function() { return this.height - margin.top - margin.bottom; }.bind(this);

            // Create the SVG element with the initial size.
            this.svg = d3.select("#" + this.containerID).append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            // Create groups for rendering layers
            let g = this.svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            let cohortGroupID = this.containerID + "_cohorts";
            let operatorGroupID = this.containerID + "_operators";

            g.append("g").attr("class", "links");
            g.append("g").attr("class", "cohorts").attr("id", cohortGroupID);
            g.append("g").attr("class", "operators").attr("id", operatorGroupID);

            // Create tooltips
            let numberFormat = d3.format(".3f");
            let percentFormat = d3.format(".0%");

            function operatorToString(operator) {
                if (operator.type) {
                    // Attribute
                    return operator.type.label + " = " + operator.value;
                }
                else if (operator.constraint) {
                    // Timeline event
                    let cnst = operator.constraint;
                    let s = "";

                    if (cnst.constraint) {
                        s = typeString(cnst.constraint.type);
                    }
                    else {
                        s += cnst.excluded ? "Inclusion: " : "";
                        s += cnst.src ? typeString(cnst.src.type) : "Start";
                        s += " ⇒ ";
                        s += cnst.dest ? typeString(cnst.dest.type) : "End";

                        if (cnst.excluded) {
                            s += "<br>Exclusion: ";
                            s += cnst.excluded.map(function(d) {
                                return typeString(d.type);
                            }).join(" | ");
                        }
                    }

                    return s;
                }

                function typeString(d) {
                    return d.code + ": " + d.label;
                }
            }

            function operatorString(d) {
                let operators = [];
                let currentCohort = d;

                while (currentCohort.parentOperator) {
                    let op = currentCohort.parentOperator;

                    operators.push(operatorToString(op));

                    currentCohort = self.data.cohorts[op.parCohort];
                }

                return operators.length === 0 ? "Root" : operators.reverse().map(function(d, i) {
                    return (
                        "<div style='display: flex'>" +
                        "<div style='flex: 0 0 auto'>•</div>" +
                        "<div style='flex: 1 0 auto'>" + d + "</div>" +
                        "</div>"
                    );
                }).join("");
            }

            this.baselineTip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-6, 0])
                .direction("n")
                .html(function(d) {
                    return "<div><strong>BASELINE</strong></div>" +
                        (d.isExcluded ? "<div>EXCLUDED:</div>" : "") +
                        "<div>" + operatorString(d) + "</div>";
                });

            this.svg.call(this.baselineTip);

            this.focusTip = d3.tip()
                .attr("class", "d3-tip")
                .offset([-18, -6])
                .direction("n")
                .html(function(d) {
                    return "<div><strong>FOCUS</strong></div>" +
                        (d.isExcluded ? "<div>EXCLUDED:</div>" : "") +
                        "<div>" + operatorString(d) + "</div>";
                });

            this.svg.call(this.focusTip);

            this.cohortTip = d3.tip()
                .attr("class", "d3-tip")
                .offset([0, 6])
                .direction("e")
                .html(function(d) {
                    let cohort = d.data;

                    return (cohort.baseline ? "<div><strong>BASELINE</strong></div><hr>" :
                        cohort.focus ? "<div><strong>FOCUS</strong></div><hr>" : "") +
                        (cohort.isExcluded ? "<div>EXCLUDED:</div>" : "") +
                        "<div>" + operatorString(cohort) + "</div>" +
                        "<hr>" +
                        "<div>Size: " + cohort.stats.size + "</div>" +
                        "<div>Baseline distance: " + numberFormat(self.data.distances[cohort.id][self.baseline.id]) + "</div>" +
                        "<div>Drift: " + numberFormat(self.cohortDrift(cohort)) + "</div>"
                        "<div>Outcome: " + percentFormat(cohort.stats.avgoutcome) + "</div>";
                });

            this.svg.call(this.cohortTip);

            this.operatorTip = d3.tip()
                .attr("class", "d3-tip")
                .offset([0, 18])
                .direction("e")
                .html(function (d) {
                    let operator = d.data;
                    let operatorString = operatorToString(operator);

                    let incCohort = self.data.cohorts[operator.incCohort];
                    let exCohort = self.data.cohorts[operator.exCohort];

                    return "<div>" + operatorString + "</div>" +
                    "<hr>" +
                    (exCohort.show ?
                        "<div>Included drift: " + numberFormat(self.cohortDrift(incCohort)) + "</div>" +
                        "<div>Excluded drift: " + numberFormat(self.cohortDrift(exCohort)) + "</div>" :
                        "<div>Drift: " + numberFormat(self.cohortDrift(incCohort)) + "</div>"
                    );
                });

            this.svg.call(this.operatorTip);

            // Create context menus
            this.cohortMenu = new Menu({
                targetNodeIds: [cohortGroupID],
                selector: "circle"
            });
            this.baselineMenuItem = new MenuItem({
                label: "Select as baseline...",
                onClick: function(){
                    let cohort = d3.select(this.getParent().currentTarget).datum();

                    self.dispatcher.call("baseline", self, cohort);
                }
            });
            this.cohortMenu.addChild(this.baselineMenuItem);
            this.focusMenuItem = new MenuItem({
                label: "Select as focus...",
                onClick: function(){
                    let cohort = d3.select(this.getParent().currentTarget).datum();

                    self.dispatcher.call("focus", self, cohort);
                }
            });
            this.cohortMenu.addChild(this.focusMenuItem);
            this.showTimelineMenuItem = new MenuItem({
                label: "Show timeline...",
                onClick: function(){
                    let cohort = d3.select(this.getParent().currentTarget).datum();

                    self.dispatcher.call("showTimeline", self, cohort);
                }
            });
            this.cohortMenu.addChild(this.showTimelineMenuItem);
            this.hideMenuItem = new MenuItem({
                label: "Hide...",
                onClick: function(){
                    let cohort = d3.select(this.getParent().currentTarget).datum();

                    cohort.show = false;

                    if (cohort.baseline) {
                        let root = self.data.cohorts[self.data.root];
                        self.dispatcher.call("baseline", self, root);
                    }
                    else if (cohort.focus) {
                        let included = self.data.cohorts[cohort.parentOperator.incCohort];
                        self.dispatcher.call("focus", self, included);
                    }
                    else {
                        self.render();
                    }
                }
            });
            this.cohortMenu.addChild(this.hideMenuItem);

            this.operatorMenu = new Menu({
                targetNodeIds: [operatorGroupID],
                selector: "path"
            });
            this.showExcludedMenuItem = new MenuItem({
                label: "Show excluded cohort...",
                onClick: function(){
                    let operator = d3.select(this.getParent().currentTarget).datum();
                    let cohort = self.data.cohorts[operator.exCohort];

                    cohort.show = true;

                    self.render();
                }
            });
            this.operatorMenu.addChild(this.showExcludedMenuItem);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height;

            // Update the SVG element
            this.svg
                .attr("height", this.height)
                .attr("width", this.width);

            // Trigger a re-render
            this.render();
        }

        init(init_data) {
            // Store a reference to the data.
            this.data = init_data;

            this.render();
        }

        update(update_data) {
            // Store a reference to the data
            this.data = update_data;

            this.render();
        }

        setOption(parameter, value) {
            let self = this;

            switch (parameter) {
                case "driftType":
                    setDriftType(value);
                    break;

                default:
                    console.log("Unknown parameter: " + parameter);
            }

            function setDriftType(value) {
                switch (value) {
                    case "baseline":
                    case "parent":
                        self.driftType = value;

                        console.log("Drift type: " + value);

                        self.render();

                        break;

                    default:
                        console.log("Invalid value: " + value);
                }
            }
        }

        cohortDrift(cohort) {
            let parent = cohort.parentOperator ? this.data.cohorts[cohort.parentOperator.parCohort] : cohort;

            switch (this.driftType) {
                case "baseline":
                    return this.data.distances[cohort.id][this.baseline.id] -
                           this.data.distances[parent.id][this.baseline.id];

                case "parent":
                    return this.data.distances[cohort.id][parent.id];

                default:
                    // Should never be here...
                    return 0;
            }
        }

        // The render function, which should update all elements of this visualization.
        render() {
            // Save reference to this for use in inner functions
            let self = this;

            // Create tree layout.
            let root = this.data.cohorts[this.data.root];
/*
            console.log(this.data.cohorts);

            let parent = null;
            let chain = [];

            function traverse(d) {
                if (isCohort(d)) {
                    if (d.show) {
                        if (parent) {
                            parent.children = [d]
                        }
                    }
                    else {
                        if (parent) {

                        }
                    }
                }
                else {

                }
            }

            console.log(root);
*/
            let hierarchy = d3.hierarchy(root, function(d) {
                if (d.operators) {
                    return d.operators;
                }
                else {
                    let inc = self.data.cohorts[d.incCohort];
                    let ex = self.data.cohorts[d.exCohort];

                    let show = [];
                    if (ex.show && inc.show) show.push(ex);
                    if (inc.show) show.push(inc);

                    return show;
                }
            });

            let tree = d3.tree()
                .size([this.innerWidth(), this.innerHeight()])
                .separation(function() { return 1; });

            tree(hierarchy);

            hierarchy.eachBefore(function(d) {
                if (!isCohort(d.data))  {
                    const portOffset = self.data.cohorts[d.data.exCohort].show ? 4 : 0;

                    d.leftPort = {
                        x: d.x - portOffset,
                        y: d.y
                    };

                    d.rightPort = {
                        x: d.x + portOffset,
                        y: d.y
                    };
                }
            });

            // Get tree nodes as an array
            let nodes = hierarchy.descendants();
            let cohorts = nodes.filter(function(d) {
                return isCohort(d.data);
            });

            // Maximum distance
            let maxDistance = d3.max(d3.values(self.data.distances), function(d) {
               return d3.max(d3.values(d));
            });

            // Set baseline
            this.baseline = cohorts.filter(function(d) {
               return d.data.baseline;
            });

            this.baseline = this.baseline.length > 0 ? this.baseline[0].data : null;

            // TODO: Switch to a d3 scheme chromatic color map
            let linkStrokeScale = d3.scaleLinear()
                .domain([-maxDistance, 0, maxDistance])
                .range(["#2166ac", "#999", "#b2182b"])
                .clamp(true);

            let linkWidthScale = d3.scaleLinear()
                .domain([0, maxDistance])
                .range([1, 5])
                .clamp(true);

            // Transition duration
            let duration = 250;
            let delay = cohorts.length > 2 ? duration : 0;

            // Draw
            drawCohorts();
            drawOperators();
            drawLinks();

            function excluded(d) {
                return d.isExcluded ? "excluded" : "included";
            }

            function isCohort(d) {
                return Boolean(d.operators);
            }

            function drawCohorts() {
                // Update cohort node function
                self.cohortNode
                    .distances(self.data.distances)
                    .maxSize(root.stats.size)
                    .baseline(self.baseline);

                // Bind data
                let cohort = self.svg.select(".cohorts").selectAll(".cohort")
                    .data(nodes.filter(function(d) {
                        return isCohort(d.data);
                    }), function(d) {
                        return d.data.id;
                    });

                // Enter + update
                cohort.enter().append("g")
                    .attr("class", "cohort")
                    .attr("transform", transform)
                    .on("contextmenu", function(d, i) {
                        if (d.data.focus) {
                            self.baselineMenuItem.set("disabled", true);
                            self.focusMenuItem.set("disabled", true);
                        }
                        else if (d.data.baseline) {
                            self.baselineMenuItem.set("disabled", true);
                            self.focusMenuItem.set("disabled", true);
                        }
                        else {
                            self.baselineMenuItem.set("disabled", false);
                            self.focusMenuItem.set("disabled", false);
                        }

                        self.hideMenuItem.set("disabled", d.data.isExcluded ? false : true);
                    })
                  .merge(cohort)
                    .on("mouseover", self.cohortTip.show)
                    .on("mouseout", self.cohortTip.hide)
                    .each(function(d) {
                        let cohort = d3.select(this).selectAll(".cohortGlyph")
                            .data([d.data]);

                        cohort.enter().append("g")
                            .attr("class", "cohortGlyph")
                          .merge(cohort)
                            .call(self.cohortNode);
                    })
                  .transition().duration(duration)
                    .attr("transform", transform);

                // Exit
                cohort.exit().remove();

                // Cohort highlight tooltip
                self.svg.select(".cohorts").selectAll(".highlight")
/*
                    .each(function(d) {
                        /*
                        if (d.baseline) {
                            if (self.showBaselineTooltip) {
                                self.baselineTip.show(d);
                            }
                            else {
                                self.baselineTip.hide();
                            }
                        }
                        else {
                            if (self.showFocusTooltip) {
                                self.focusTip.show(d);
                            }
                            else {
                                self.focusTip.hide();
                            }
                        }
                    })
*/
                    .on("click", function(d) {
                        d3.event.stopPropagation();

                        if (d.baseline) {
                            self.showBaselineTooltip = !self.showBaselineTooltip;

                            if (self.showBaselineTooltip) {
                                self.baselineTip.show(d);
                            }
                            else {
                                self.baselineTip.hide();
                            }
                        }
                        else {
                            self.showFocusTooltip = !self.showFocusTooltip;

                            if (self.showFocusTooltip) {
                                self.focusTip.show(d);
                            }
                            else {
                                self.focusTip.hide();
                            }
                        }
                    })
                    .on("mouseover", function(d) {
                        d3.event.stopPropagation();

                        if (d.baseline) self.baselineTip.show(d);
                        else self.focusTip.show(d);
                    })
                    .on("mouseout", function(d) {
                        d3.event.stopPropagation();

                        if (d.baseline && !self.showBaselineTooltip) self.baselineTip.hide();
                        else if (d.focus && !self.showFocusTooltip) self.focusTip.hide();
                    });

                self.baselineTip.hide();
                self.focusTip.hide();

                function transform(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                }
            }

            function drawOperators() {
                const symbolSize = 121;

                const showExSymbol = d3.symbol()
                    .type(d3.symbolWye)
                    .size(symbolSize);

                const symbol = d3.symbol()
                    .type(mySymbol)
                    .size(symbolSize);

                // Custom symbol when not showing excluded cohort
                function mySymbol() {
                    const s = Math.sqrt(3) / 2,
                        k = 1 / Math.sqrt(12);

                    function mySymbol() {}

                    mySymbol.draw = function(context, size) {
                        const w = Math.sqrt(size),
                            y = w * s,
                            x = y * k;
                        context.moveTo(x, 0);
                        context.lineTo(x, y);
                        context.lineTo(-x, y);
                        context.lineTo(-x, y / 3);
                        context.lineTo(-x * 1.75, y / 3);
                        context.lineTo(-x * 1.75, -y / 3);
                        context.lineTo(-x, -y / 3);
                        context.lineTo(-x, -y);
                        context.lineTo(x, -y);
                        context.closePath();
                    };

                    return mySymbol;
                }

                // Bind data
                const operator = self.svg.select(".operators").selectAll(".operator")
                    .data(nodes.filter(function(d) {
                        return !isCohort(d.data);
                    }), function(d) {
                        return d.data.incCohort + "_" + d.data.exCohort;
                    });

                // Enter + update
                operator.enter().append("g")
                    .attr("class", "operator")
                    .attr("transform", transform)
                    .on("contextmenu", function(d, i) {
                        // Enable the appropriate options for this item
                        let excluded = self.data.cohorts[d.data.exCohort];

                        self.showExcludedMenuItem.set("disabled", excluded.show);
                    })
                  .merge(operator)
                    .on("mouseover", self.operatorTip.show)
                    .on("mouseout", self.operatorTip.hide)
                    .each(function(d) {
                        const inc = self.data.cohorts[d.data.incCohort];
                        const ex = self.data.cohorts[d.data.exCohort];

                        const drift = self.cohortDrift(inc);

                        const operator = d3.select(this).selectAll(".operatorGlyph")
                            .data([d.data]);

                        operator.enter().append("path")
                            .attr("class", "operatorGlyph")
                            .style("stroke", "white")
                            .style("stroke-width", 2)
                            .style("stroke-linejoin", "round")
                          .merge(operator)
                          .transition().duration(duration)
                            .attr("d", ex.show ? showExSymbol : symbol)
                            .attr("transform", ex.show ? "rotate(-60)" : "rotate(0)")
                            .style("fill", linkStrokeScale(drift));
                    })
                  .transition().duration(duration)
                    .attr("transform", transform);

                // Exit
                operator.exit().remove();

                function transform(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                }
            }

            function drawLinks() {
/*
                let leaves = hierarchy.leaves();
                let spacing = leaves.length > 1 ? Math.abs(hierarchy.leaves()[0].x - hierarchy.leaves()[1].x) : 0,
                    c = spacing / 2;

                // Same style as used in Cell Cycle Browser
                let curveElbow = function(d) {
                    let r = d3.min([c, Math.abs(d.parent.x - d.x), Math.abs(d.parent.y - d.y)]),
                        left = d.parent.x < d.x;

                    return  "M" + d.x + "," + d.y +
                            "V" + (d.parent.y + r) +
                            "q" + 0 + "," + -r + "," + (left ? -r : r) + "," + -r +
                            "H" + d.parent.x;
                };
*/

                // d3 style
                let linkShape = d3.linkVertical()
                    .source(function(d) {
                        return isCohort(d.data) ?
                            (d.data.isExcluded ? d.parent.leftPort : d.parent.rightPort) :
                            d.parent;
                    })
                    .target(function(d) { return d; })
                    .x(function(d) { return d.x; })
                    .y(function(d) { return d.y; });

                // Bind data
                let link = self.svg.select(".links").selectAll(".link")
                    .data(nodes.slice(1), function(d) {
                        return isCohort(d.data) ? d.data.id + "_2" : d.data.incCohort + "_1";
                    });

                // Enter
                let linkEnter = link.enter().append("path")
                    .attr("class", "link")
                    .attr("d", linkShape)
                    .style("fill", "none")
                    .style("stroke", stroke)
                    .style("stroke-width", strokeWidth);

                linkEnter.each(function(d) {
                    let link = d3.select(this);
                    let length = link.node().getTotalLength();

                    link.style("stroke-dasharray", length + " " + length)
                        .style("stroke-dashoffset", length)
                      .transition().duration(duration).delay(delay).ease(d3.easeCubicIn)
                        .style("stroke-dashoffset", 0)
                        .on("end", function(d) {
                            d3.select(this)
                                .style("stroke-dasharray", null)
                                .style("stroke-dashoffset", null);
                        });
                });

                // Update
                link.transition().duration(duration)
//                    .attr("d", curveElbow)
                    .attr("d", linkShape)
                    .style("stroke", stroke)
                    .style("stroke-width", strokeWidth);

                // Exit
                link.exit().remove();

                function stroke(d) {
                    let cohort = isCohort(d.data) ? d.data : self.data.cohorts[d.data.incCohort];

                    return linkStrokeScale(self.cohortDrift(cohort));
                }

                function strokeWidth(d) {
                    let cohort = isCohort(d.data) ? d.data : self.data.cohorts[d.data.incCohort];

                    return linkWidthScale(Math.abs(self.cohortDrift(cohort)));
                }
            }
        }
    }
})
