"use strict"
define([
    "dojo/_base/declare",
    "dojo/dom",
    "dojo/dom-construct",
    "cadence/vis/controls/AdjustableLinearScale",
    "cadence/vis/CohortRefinementVisualization",
    "cadence/vis/CohortOverviewVisualization"
], (declare, dom, domConstruct, AdjustableLinearScale, CohortRefinementVisualization, CohortOverviewVisualization) => {
    return class {
        constructor(_cadence) {

            let this_vis = this;

            this.cadence = _cadence;

            // Initialize data
            this.cohorts = null;
            this.distances = null;
            this.root = null;
            this.baseline = null;

            this.outcomeColormapMin = 0.00;
            this.outcomeColormapMax = 0.25;
            this.correlationColormapMin = 0.00;
            this.correlationColormapMax = 1.00;

            this.outcomeColormap = new AdjustableLinearScale("timeline_legend_container", 80, 30, 7, 0, 100, 0, 25, "%", ".0f");
            this.outcomeColormap.on("update", function(min, max) {
                for (let panel_id in this_vis.cohortRefinementPanels) {
                    this_vis.outcomeColormapMin = min;
                    this_vis.outcomeColormapMax = max;
                    this_vis.cohortRefinementPanels[panel_id].updateOutcomeColormapRange(this_vis.outcomeColormapMin, this_vis.outcomeColormapMax);
                }
            });

            this.correlationColormap = new AdjustableLinearScale("scatterplot_legend_container", 80, 30, 13, -0.25, 0.25, -0.25, 0.25, '', ".2n");
            this.correlationColormap.on("update", function(min, max) {
                for (let panel_id in this_vis.cohortRefinementPanels) {
                    this_vis.correlationColormapMin = min;
                    this_vis.correlationColormapMax = max;
                    this_vis.cohortRefinementPanels[panel_id].updateCorrelationColormapRange(this_vis.correlationColormapMin, this_vis.correlationColormapMax);
                }
            });

            // We start with one refinement panel.  More may be added as users interact with the system...
            let new_cohort_panel = new CohortRefinementVisualization("panel_container_1");
            this.cohortRefinementPanels = {"panel_container_1" : new_cohort_panel};
            this.cohortNodeIcons = {};

            // Register listeners for events from the cohort refinement panel.
            new_cohort_panel.on("filter", function(args) {
                cadence.postRequest("filter", args, this_vis, this_vis.filterHandler);
            });
            new_cohort_panel.on("close", function(args) {
                if (Object.keys(this_vis.cohortRefinementPanels).length > 1) {
                    domConstruct.destroy("panel_container_1");
                    delete this_vis.cohortRefinementPanels["panel_container_1"];
                    cadence.postRequest("close", args, this_vis, this_vis.closeCohortHandler);
                }
                else {
                    cadence.dialogs.showError("You must maintain at least one open cohort.");
                }
            });

            // Include cohort overview.
            this.cohortOverviewPanel = new CohortOverviewVisualization("cohort_overview_vis_container");

            // Register listeners for events from the cohort overview panel.
            this.cohortOverviewPanel.on("baseline", function(args) {
                cadence.postRequest("baseline", args, this_vis, this_vis.baselineHandler);
            });

            this.cohortOverviewPanel.on("focus", function(args) {
                // Don't allow setting baseline to focus
                if (args.baseline) return;

                cadence.postRequest("focus", args, this_vis, this_vis.focusHandler);
            });

            this.cohortOverviewPanel.on("showTimeline", function(args) {
                this_vis.showTimelineHandler(args);
            });
        }

        init(init_data) {
            // Initialize baseline and focus
            let root = init_data.cohorts[init_data.root];
            root.baseline = true;
            root.focus = false;

            // Acquire Additional info for node View (data might not be complete yet)
            root.distances = init_data.distances;
            root.maxSize = root.stats.size;

            this.cohortRefinementPanels["panel_container_1"].createIcon(root);
            this.cohortRefinementPanels["panel_container_1"].init(root);
            this.cohortOverviewPanel.init(init_data);

            // Save data
            this.cohorts = init_data.cohorts;
            this.saveData(init_data);
        }

        saveData(cohortTree) {
            this.setCohortAttributes(cohortTree.cohorts);
            this.distances = cohortTree.distances;
            this.root = cohortTree.root;
            this.baseline = cohortTree.baseline;
        }

        filterHandler(_args) {
            this.saveData(_args.cohortTree);

            let node = this.cohorts[_args.newCohortID];
            node.distances = this.distances;
            node.maxSize = this.cohorts[this.root].stats.size;
            let new_vis = this.addCohortRefinementPanel(node);

            // Update cohort icons, retrieve cohort id and attach focus and baseline

            this.updateRefinementPanelIcons(_args.cohortTree);

            // Update cohort overview
            this.cohortOverviewPanel.update(_args.cohortTree);
        }

        addCohortRefinementPanel(cohort) {
            // Add cohort refinement panel.
            let _uid = cadence.uidGenerator();
            let div_panel=dom.byId("cohort_details_vis_container");

            let new_div = domConstruct.place("<div id="+_uid+ " style='margin: 5px 5px 0px 0px; box-shadow: 3px 3px #aaaaaa; height: 450px; max-height: 450px; overflow:hidden; padding:3px; border:1px solid gray;' data-dojo-type='dijit/layout/ContentPane'> </div>",div_panel, "last");
            div_panel.append(new_div);
            let new_vis = new CohortRefinementVisualization(_uid);
            this.cohortRefinementPanels[_uid] = new_vis;

            let this_vis = this;
            new_vis.on("filter", function(args) {
                cadence.postRequest("filter", args, this_vis, this_vis.filterHandler);
            });
            new_vis.on("close", function(args) {
                if (Object.keys(this_vis.cohortRefinementPanels).length > 1) {
                    domConstruct.destroy(_uid);
                    delete this_vis.cohortRefinementPanels[_uid];
                    cadence.postRequest("close", args, this_vis, this_vis.closeCohortHandler);
                }
                else {
                    cadence.dialogs.showError("You must maintain at least one open cohort.");
                }
            });

            new_vis.createIcon(cohort);
            new_vis.init(cohort);

            div_panel.scrollIntoView(false);

            // Update cohort overview
            new_vis.updateOutcomeColormapRange(this.outcomeColormapMin, this.outcomeColormapMax);
            new_vis.updateCorrelationColormapRange(this.correlationColormapMin, this.correlationColormapMax);
        }

        closeCohortHandler(_args) {
            this.setCohortAttributes(_args.cohortTree.cohorts);

            // Update cohort overview
            this.cohortOverviewPanel.update(_args.cohortTree);
        }

        baselineHandler(_args) {
            this.saveData(_args.cohortTree);

            // Update cohort Icon for refinement panel
            this.updateRefinementPanelIcons();

            // Update cohort overview
            this.cohortOverviewPanel.update(_args.cohortTree);
        }

        focusHandler(_args) {
            this.saveData(_args.cohortTree);

            // Update cohort Icon for refinement panel
            this.updateRefinementPanelIcons();

            // Update cohort overview
            this.cohortOverviewPanel.update(_args.cohortTree);
        }

        showTimelineHandler(_args) {
            // See if it already has a refinement panel
            let panelArray = d3.values(this.cohortRefinementPanels);

            let ids = panelArray.map(function(d) {
                return d.data.id;
            });

            let index = ids.indexOf(_args.id);

            if (index === -1) {
                // Create a new one
                let node = this.cohorts[_args.id];
                node.distances = this.distances;
                node.maxSize = this.cohorts[this.root].stats.size;

                this.addCohortRefinementPanel(node);

                this.updateRefinementPanelIcons();
            }
            else {
                // Scroll this one into view
                dom.byId(panelArray[index].container_id).scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest"
                });
            }
        }

        setCohortAttributes(newCohorts) {
            let oldCohorts = this.cohorts;

            // Defaults
            let defaults = {
                show: function(d) { return d.isExcluded ? false : true; }
            };

            // Set any attributes that are not saved on the server
            Object.keys(newCohorts).forEach(function(key) {
                let newCohort = newCohorts[key];
                let oldCohort = oldCohorts[key];

                if (oldCohort) {
                    Object.keys(oldCohort).forEach(function(key) {
                        if (newCohort[key] === undefined) {
                            newCohort[key] = oldCohort[key];
                        }
                    });
                }
                else {
                    Object.keys(defaults).forEach(function(key) {
                        let v = defaults[key];

                        newCohort[key] = typeof(v) === 'function' ? v(newCohort) : v;
                    });
                }
            });

            this.cohorts = newCohorts;
        }

        // Command-line options

        setCohortTreeOption(parameter, value) {
            this.cohortOverviewPanel.setCohortTreeOption(parameter, value);
        }

        setCohortComparisonOption(parameter, value) {
            this.cohortOverviewPanel.setCohortComparisonOption(parameter, value);
        }

        setIciclePlotOption(parameter, value) {
            this.cohortOverviewPanel.setIciclePlotOption(parameter, value);
        }

        setScatterPlotOption(parameter, value) {
            for (let panel_id in this.cohortRefinementPanels) {
                this.cohortRefinementPanels[panel_id].setScatterPlotOption(parameter, value);
            }
        }

        updateRefinementPanelIcons() {
            for(let panel_id in this.cohortRefinementPanels){
                // Update current distance matrix
                let cid = this.cohortRefinementPanels[panel_id].cohort_id;
                this.cohortRefinementPanels[panel_id].updateDistances(this.distances);

                // Iteratively update cohort icons
                let baselineCohort = this.cohorts[this.baseline];
                let currentCohort = this.cohorts[cid];
                this.cohortRefinementPanels[panel_id].updateNodeIcon(baselineCohort,currentCohort);
            }
        }
    }
});