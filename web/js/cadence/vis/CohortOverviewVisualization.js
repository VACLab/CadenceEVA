"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/parser",
    "dojo/query",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/layout/TabContainer",
    "dijit/layout/ContentPane",
    "dijit/form/HorizontalSlider",
    "dojo/aspect",
    "cadence/vis/components/CohortTree",
    "cadence/vis/components/CohortOverlap",
    "cadence/vis/components/CohortDistanceIcicleView",
    "cadence/vis/components/CohortDistanceDotView",
    "cadence/vis/components/CohortDistanceListView",
    "cadence/vis/components/CategoricalDistribution",
    "cadence/vis/components/NumericDistribution",
    "cadence/vis/components/EventDistribution",
    "cadence/vis/controls/AdjustableLinearScale",
], (declare, lang, dom, domConstruct, parser, query, registry, Menu, MenuItem, TabContainer, ContentPane, HorizontalSlider, aspect,
    CohortTree, CohortOverlap, CohortDistanceIcicleView, CohortDistanceDotView, CohortDistanceListView, CategoricalDistribution, NumericDistribution, EventDistribution, AdjustableLinearScale) => {
    return class {
        constructor(dom_container_id) {
            this.dispatch = d3.dispatch("baseline", "focus", "showTimeline");

            // Add the visual elements for this visualization.
            this.container_id = dom_container_id;

            let container = dom.byId(dom_container_id);

            this.tree_distance_slider_id = dom_container_id + "_tree_distance_slider";
            this.tree_container_id = dom_container_id + "_tree";
            this.comparison_container_id = dom_container_id + "_comparison";

            // Flag for whether we have distance information (baseline and focus) yet
            this.hasDistance = false;

            // Current view and selected attribute/event
            this.currentView = null;
            this.selectedAttribute = null;
            this.selectedEvent = null;

            container.innerHTML =
                "<div style='height: 100%; margin-left: 5px; display: flex; flex-direction: column'>" +
                    "<div style='display: flex;'>" +
                        "<div style='font-weight: bold; flex: 1 0 auto;'>Cohort Tree</div>" +
                        //"<div style='display: flex; align-items: center; flex: 0 0 auto;'>" +
                        //    "<div style='font-size: x-small; flex: 0 0 auto;'>Distance:</div>" +
                        //    "<div id='"+this.tree_distance_slider_id+"' style='flex: 1 0 auto;'></div>" +
                        //"</div>" +
                    "</div>" +
                    "<div id='"+this.tree_container_id+"' style='height: 0px; width:100%; flex: 2;'><img src='img/hourglass_spinner.svg'></div>" +
                    "<hr style='width: 100%'>" +
                    "<div style='font-weight: bold;'>Cohort Comparison</div>" +
                    "<div id='"+this.comparison_container_id+"' style='height: 0px; width:100%; flex: 3; display: flex; flex-direction: column'><img src='img/hourglass_spinner.svg'></div>" +
                "</div>";
        }

        on(event_name, event_handler) {
            this.dispatch.on(event_name, event_handler);
        }

        // This is for steps that have to be done after the initial construction, such as the first resize.  Note that
        // this resize should trigger a render automatically.
        init(init_data) {
            this.data = init_data;
            this.distanceData = this.processDistanceData(this.data);

            // We have data, and the vis has been populated with containers during construction.  To init, store refs
            // to the individual container divs to which we'll be adding the visualizations.
            this.treeDiv = dom.byId(this.tree_container_id);
            this.treeDiv.innerHTML = "";

            //this.cohortDistanceColormap = new AdjustableLinearScale(this.tree_distance_slider_id, 80, 30, 0, 0, 1, 0, 1, "", ".2f", ["#999", "#b2182b"], false);
            //this.cohortDistanceColormap.on("update", function(min, max) {
                //console.log(min, max);
            //});

            this.comparisonDiv = dom.byId(this.comparison_container_id);
            this.comparisonDiv.innerHTML = "";

            // Create the tree visualization
            this.cohortTree = new CohortTree(this.tree_container_id);
            this.cohortTree.init(this.data);
            this.cohortTree.on("baseline", lang.hitch(this, this.baselineCallback));
            this.cohortTree.on("focus", lang.hitch(this, this.focusCallback));
            this.cohortTree.on("showTimeline", lang.hitch(this, this.showTimelineCallback));

            // Check for distance information. Shouldn't be any yet, but just in case
            if (!this.hasDistance && this.data.focusDistance) {
                this.initComparison(this.data.focusDistance);
            }
            else {
                this.cohortOverlap = null;
                this.cohortDistanceIcicleView = null;
                this.cohortDistanceDotView = null;
                this.cohortDistanceListView = null;
                this.distributionVis = null;
            }

            // Now render the data.
            this.render();
        }

        // Update with new data
        update(update_data) {
            this.data = update_data;
            this.distanceData = this.processDistanceData(this.data);

            if (!this.hasDistance && this.data.focusDistance) {
                this.initComparison();
            }

            this.setThreshold();

            this.render();
        }

        processDistanceData(data) {
            // Check for distance info
            let distances = data.focusDistance;

            if (distances === undefined) return null;

            // Get all attributes
            let attributes = d3.values(distances.attributes);

            // Get all events
            let events = d3.values(distances.events);

            // Calculate distance gradient for events with hierarchical structure
            events.forEach(function(d) {
                d.gradient =  d.parent_id ? d.distance - distances.events[d.parent_id].distance : 0.0;
                d.gradientMag = Math.abs(d.gradient);
            });

            // Get constraints
            let constraints = getConstraints(data.cohorts[data.root], attributes, events);

            // Get event constraint descendants
            let constraintDescendants = events.filter(d => {
               for (let i = 0; i < constraints.length; i++) {
                   if (isDescendant(d, constraints[i])) return true;
               }
               return false;
            });

            let range = dataRange(attributes, events, constraints.concat(constraintDescendants));

            // Get event categories (e.g. ICD10 or SNOMED)
            let categories = d3.set();
            events.forEach(function(d) {
                categories.add(d.cat);
            });
            categories = categories.values();

            // Group events by category and stratify them
            let eventGroups = categories.map(function(d) {
                let groupEvents = events.filter(function(e) {
                    return e.cat === d;
                });

                return {
                    cat: d,
                    root: d3.stratify()
                        .id(function(d) { return d.id; })
                        .parentId(function(d) { return d.parent_id; })
                        (groupEvents)
                };
            });

            return {
                attributes: attributes,
                eventGroups: eventGroups,
                constraints: constraints,
                range: range
            };

            function isDescendant(event1, event2) {
                let e = event1;
                while (e.parent_id) {
                    e = distances.events[e.parent_id];
                    if (e.id === event2.id) return true;
                }

                return false;
            }

            function dataRange(attributes, events, constraints) {
                // Get non-constraint attributes and events
                const constraintIds = constraints.map(d => d.id ? d.id : d.code);
                const nonConstraintAttributes = attributes.filter(d => constraintIds.indexOf(d.code) === -1);
                const nonConstraintEvents = events.filter(d => constraintIds.indexOf(d.id) === -1);

                // Calculate maximum distances
                const maxAttributeDistance = d3.max(attributes, d => d.distance);
                const maxEventDistance = d3.max(events, d => d.distance);
                const maxNonConstraintDistance = d3.max(nonConstraintAttributes.concat(nonConstraintEvents), d => d.distance);
                const maxDistance = Math.max(maxAttributeDistance, maxEventDistance);

                // Calculate gradient range
                const gradientRange = d3.extent(events, function(d) {
                    return d.gradient;
                });

                const gradientMags = events.map(function(d) {
                    return d.gradientMag;
                });

                gradientMags.sort(d3.ascending);

                const maxGradientMag = gradientMags[gradientMags.length - 1];

                return {
                    maxDistance: maxDistance,
                    maxNonConstraintDistance: maxNonConstraintDistance,
                    maxAttributeDistance: maxAttributeDistance,
                    maxEventDistance: maxEventDistance,
                    gradientRange: gradientRange,
                    gradientMags: gradientMags,
                    maxGradientMag: maxGradientMag
                };
            }

            function getConstraints(root, attributes, events) {
                // Get root constraints
                let rootConstraints = [];

                if (root.attrConstr) traverseConstraints(root.attrConstr);
                if (root.tempConstr) traverseConstraints(root.tempConstr);

                function constraintID(d) {
                    return d.code ? d.code : d.id;
                }

                function traverseConstraints(d) {
                    if (d.type) {
                        let id = constraintID(d.type);
                        if (id && rootConstraints.indexOf(id) === -1) rootConstraints.push(id);
                    }
                    if (d.a) traverseConstraints(d.a);
                    if (d.b) traverseConstraints(d.b);
                }

                // Get non-root constraints in baseline and focus
                let baseline = data.cohorts[data.baseline];
                let focus = data.cohorts[data.focus];
                let constraints = [];
                [baseline, focus].forEach(function(cohort) {
                    let operators = [];
                    let currentCohort = cohort;

                    while (currentCohort.parentOperator) {
                        let operator = currentCohort.parentOperator;
                        let currentConstraints = [];

                        if (operator.type) {
                            currentConstraints.push(operator.type);
                        }
                        else if (operator.constraint) {
                            let constraint = operator.constraint;

                            if (constraint.constraint) {
                                currentConstraints.push(constraint.constraint.type);
                            }
                            else {
                                if (constraint.src) currentConstraints.push(constraint.src.type);
                                if (constraint.dest) currentConstraints.push(constraint.dest.type);
                            }
                        }

                        currentConstraints.forEach(function(constraint) {
                            let id = constraintID(constraint);

                            if (rootConstraints.indexOf(id) === -1 &&
                                constraints.map(constraintID).indexOf(id) === -1) {
                                constraints.push(constraint);
                            }
                        });

                        currentCohort = data.cohorts[operator.parCohort];
                    }
                });

                return constraints;
            }
        }

        initComparison() {
            let self = this;

            let tab_container_id = this.container_id + "_tabs";
            let overlap_container_id = this.container_id + "_overlap";
            let icicle_container_id = this.container_id + "_icicle";
            let dot_container_id = this.container_id + "_dot";
            let list_container_id = this.container_id + "_list";
            let distribution_container_id = this.container_id + "_distribution";

            this.comparisonDiv.innerHTML =
                "<div style='font-weight: normal; font-size: 12px;'>Overlap</div>" +
                "<div id='"+overlap_container_id+"' style='height: 20px; padding-left: 5px; flex: 0 0 auto'></div>" +
                "<div style='font-weight: normal; font-size: 12px;'>Distance</div>" +
                "<div style=' font-size: 10px; margin-bottom: 5px; display: flex; flex-wrap: wrap'>" +
                    "<div id='thresholdSlider'>Hierarchy simplification</div>" +
                    "<input type='text' id='eventSearch' style='flex: 1 0 auto;' list='eventList' placeholder='Event search'></input>" +
                    "<datalist id='eventList'></datalist>" +
                "</div>" +
                "<div style='height: 0px; padding-left: 5px; flex: 4'>" +
                    "<div id='"+tab_container_id+"'></div>" +
                "</div>" +
                "<div style='font-weight: normal; font-size: 12px; margin-top: 5px'>Selected Variable Distribution</div>" +
                "<div id='"+distribution_container_id+"' style='height: 50px; padding-left: 5px; flex: 0 0 auto'></div>";

            // Initial quantile value for setting threshold
            let quantile = 0.99;

            // Use a power scale to make selection of higher quantile values easier
            this.quantileScale = d3.scalePow()
                .exponent(0.1);

            let sliderValue = this.quantileScale.invert(quantile);

            this.slider = new HorizontalSlider({
                name: "thresholdSlider",
                value: sliderValue,
                minimum: 0,
                maximum: 1,
                intermediateChanges: false,
                showButtons: false,
                style: "margin-top: 10px; flex: 1 0 auto;",
                onChange: this.setThreshold.bind(this)
            }, "thresholdSlider");

            this.slider.startup();

            // Search box
            dom.byId("eventSearch").onchange = function(e) {
                let option = e.target.list.options.namedItem(e.target.value);

                if (option) self.selectEventCallback(self.data.focusDistance.events[option.dataset.id]);
                else self.selectEventCallback(null);
            };

            // Add events to search list
            let datalist = dom.byId("eventList");
            datalist.innerHTML = "";
            d3.values(self.data.focusDistance.events).forEach(function(event) {
                let value = event.code + ": " + event.label;

                let attrs = {
                    name: value,
                    value: value
                };
                attrs["data-id"] = event.id;

                domConstruct.create("option",  attrs, datalist);
            });

            let tabContainer = new TabContainer({
                style: "height: 100%"
            }, tab_container_id);

            let iciclePane = new ContentPane({
                title: "Icicle Plots",
                content: "<div id='"+icicle_container_id+"'></div>"
            });

            let dotPane = new ContentPane({
                title: "Dot Plots",
                content: "<div id='"+dot_container_id+"'></div>"
            });

            let listPane = new ContentPane({
                title: "List",
                content: "<div id='"+list_container_id+"'></div>"
            });

            tabContainer.addChild(iciclePane);
            tabContainer.addChild(dotPane);
            tabContainer.addChild(listPane);

            aspect.after(tabContainer, "selectChild", function (event) {
                // Get the id of the visualization container div
                const id = tabContainer.selectedChildWidget.containerNode.childNodes[0].id;

                // Get all div ids for views
                const views = [
                  self.cohortDistanceIcicleView,
                  self.cohortDistanceDotView,
                  self.cohortDistanceListView
                ];

                for (let i = 0; i < views.length; i++) {
                    const view = views[i];

                    if (view.container_id === id) {
                        self.currentView = view;
                        view.update(self.distanceData);

                        if (self.selectedAttribute) {
                            self.currentView.selectAttribute(self.selectedAttribute);
                        }
                        else {
                            self.currentView.selectEvent(self.selectedEvent);
                        }
                    }
                }
            });

            this.cohortOverlap = new CohortOverlap(overlap_container_id);
            this.cohortOverlap.init(this.data);

            this.cohortDistanceIcicleView = new CohortDistanceIcicleView(icicle_container_id);
            this.cohortDistanceIcicleView.on("selectAttribute", lang.hitch(this, this.selectAttributeCallback));
            this.cohortDistanceIcicleView.on("selectEvent", lang.hitch(this, this.selectEventCallback));
            this.cohortDistanceIcicleView.init(this.distanceData);

            this.cohortDistanceDotView = new CohortDistanceDotView(dot_container_id);
            this.cohortDistanceDotView.on("selectAttribute", lang.hitch(this, this.selectAttributeCallback));
            this.cohortDistanceDotView.on("selectEvent", lang.hitch(this, this.selectEventCallback));
            this.cohortDistanceDotView.init(this.distanceData);

            this.cohortDistanceListView = new CohortDistanceListView(list_container_id);
            this.cohortDistanceListView.on("selectAttribute", lang.hitch(this, this.selectAttributeCallback));
            this.cohortDistanceListView.on("selectEvent", lang.hitch(this, this.selectEventCallback));
            this.cohortDistanceListView.init(this.distanceData);

            this.currentView = this.cohortDistanceIcicleView;

            this.setThreshold(sliderValue);

            tabContainer.startup();
            tabContainer.resize();

            this.hasDistance = true;
        }

        setThreshold(value) {
            if (!value) {
                value = this.slider.value;
            }

            // Use quantile to set threshold
            let threshold = d3.quantile(this.distanceData.range.gradientMags, this.quantileScale(value));

            this.cohortDistanceIcicleView.setGradientThreshold(threshold);
            this.cohortDistanceDotView.setGradientThreshold(threshold);
            this.cohortDistanceListView.setGradientThreshold(threshold);
        }

        // The render function, which should update all elements of this visualization.
        render() {
            // Update the visualizations
            this.cohortTree.update(this.data);
            if (this.cohortOverlap) this.cohortOverlap.update(this.data);
            if (this.currentView) this.currentView.update(this.distanceData);
            if (this.distributionVis) this.distributionVis.update(this.data);
        }

        // Callbacks for self-contained events
        selectEventCallback(args) {
            // Clear search box if necessary
            let searchBox = dom.byId("eventSearch");
            if (!args || searchBox.value.indexOf(args.code) === -1) {
                searchBox.value = "";
            }

            this.currentView.selectEvent(args);

            // Clear distribution visualization
            let distribution_container_id = this.container_id + "_distribution";
            dom.byId(distribution_container_id).innerHTML = "";

            if (args) {
                this.distributionVis = new EventDistribution(distribution_container_id);
                this.distributionVis.init(this.data, args);
            }

            this.selectedAttribute = null;
            this.selectedEvent = args;
        }

        selectAttributeCallback(args) {
            this.currentView.selectAttribute(args);

            // Clear distribution visualization
            let distribution_container_id = this.container_id + "_distribution";
            dom.byId(distribution_container_id).innerHTML = "";

            if (args) {
                if (args.type === "string") this.distributionVis = new CategoricalDistribution(distribution_container_id);
                else if (args.type === "int") this.distributionVis = new NumericDistribution(distribution_container_id);
                else this.distributionVis = null;

                if (this.distributionVis) this.distributionVis.init(this.data, args);
            }

            this.selectedAttribute = args;
            this.selectedEvent = null;
        }

        setCohortTreeOption(parameter, value) {
            this.cohortTree.setOption(parameter, value);
        }

        setCohortComparisonOption(parameter, value) {
            this.cohortDistanceIcicleView.setOption(parameter, value);
            this.cohortDistanceDotView.setOption(parameter, value);
            this.cohortDistanceListView.setOption(parameter, value);
        }

        setIciclePlotOption(parameter, value) {
            this.cohortDistanceIcicleView.setOption(parameter, value);
        }

        // Callbacks for events of subcomponents which can trigger filters. This should "bubble up" the event for the
        // larger system to respond.
        baselineCallback(args) {
            this.dispatch.call("baseline", this, args);
        }

        focusCallback(args) {
            this.dispatch.call("focus", this, args);
        }

        showTimelineCallback(args) {
            this.dispatch.call("showTimeline", this, args);
        }
    }
})
