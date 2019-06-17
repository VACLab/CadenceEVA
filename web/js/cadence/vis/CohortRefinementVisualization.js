"use strict";
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/on",
    "dojo/dom",
    "dojo/dom-construct",
    "dijit/registry",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/aspect",
    "cadence/vis/components/AttributeCatView",
    "cadence/vis/components/AttributeIntView",
    "cadence/vis/components/AttributesAndEventsView",
    "cadence/vis/components/CohortNodeView",
    "cadence/vis/components/Timeline",
    "cadence/vis/components/EventOutcomeScatterView",
    "cadence/vis/components/KMOutcomeView",
    "cadence/vis/components/EventHistogram"
], (declare, lang, dojoOn, dom, domConstruct, registry, Menu, MenuItem, aspect, AttributeCatView, AttributeIntView, AttributesAndEventsView, CohortNodeView,Timeline, EventOutcomeScatterView, KMOutcomeView, EventHistogram) => {
    return class {
        constructor(dom_container_id) {
            this.dispatch = d3.dispatch("filter", "close");

            // Add the visual elements for this visualization.
            this.container_id = dom_container_id;

            var container = dom.byId(dom_container_id);

            container.innerHTML=
                "<div id='"+dom_container_id+"_COHORT' style='width: 54px; float:left; height:54px;'><img src='img/hourglass_spinner.svg'></div>" +
                "<div style='border: 0 solid black; float: right; height: 100%; width: 20px;'><img id='"+
                dom_container_id + "CLOSE" +
                "' style='width:16px;' src='img/trash.svg'></div>" +
                "<div style='overflow: auto; font-weight: bold; border: 0 solid black; float: left; height: 100%; width: 250px;'>" +
                    "<div style='font-weight: bold; float: left; width: 100%;'>Attributes" +
                    "<br/>" +
                    "<div id='"+dom_container_id+"_attribs' style='width:100%;'><img src='img/hourglass_spinner.svg'></div>" +
                    "</div>" +
                    "<div style='font-weight: bold; border: 0 solid black; float: left; width: 100%;'>Events" +
                    "<br/>" +
                    "<div id='"+dom_container_id+"_events' style='width:100%;'><img src='img/hourglass_spinner.svg'></div>" +
                    "</div>" +
                "</div>" +
                "<div style='font-weight: bold; border: 0 solid black; float: right; height: 100%; width: 300px;'>" +
                    "<div style='display: flex; flex-direction: column; height: 100%;'>" +
                        "<div>Outcomes</div>" +
                        "<div id='"+dom_container_id+"_scatter' style='height:300px;  width:100%;'><img src='img/hourglass_spinner.svg'></div>" +
                        "<div id='"+dom_container_id+"_outcome' style='flex: 1; width:100%;'><img src='img/hourglass_spinner.svg'></div>" +
                    "</div>" +
                "</div>" +
                "<div style='font-weight: bold; border: 0 solid black; margin-left: 320px; margin-right:340px; height: 100%;'>" +
                    "<div style='display: flex; flex-direction: column; height: 100%;'>" +
                        "<div id='"+(this.container_id + "_constraints")+"'>Constraints<br>" +
                        "</div>" +
                        "<div>Timeline</div>" +
                        "<div id='"+dom_container_id+"_timeline' style='flex: 1; width: 100%;'><img src='img/hourglass_spinner.svg'></div>" +
                    "</div>" +
                "</div>";

            // Register a click handler to the exit button.
            let this_vis = this;
            dojoOn(dom.byId(dom_container_id + "CLOSE"), "click", function(evt) {
                this_vis.dispatch.call("close", this_vis, {id: this_vis.data.id});
            });
        }

        on(event_name, event_handler) {
            this.dispatch.on(event_name, event_handler);
        }


        createIcon(cohort_data){
            this.nodeDiv = dom.byId(this.container_id+"_COHORT");
            // Initialize the node view.
            this.nodeDiv.innerHTML='';
            this.nodeVis = new CohortNodeView(this.container_id+"_COHORT");
            this.nodeVis.init(cohort_data);

            // Store cohort id
            this.cohort_id = cohort_data.id;
        }
        // This is for steps that have to be done after the initial construction, such as the first resize.  Note that
        // this resize should trigger a render automatically.
        init(init_data) {
            this.data = init_data;

            // We have data, and the vis has been populated with containers during construction.  To init, store refs
            // to the individual container divs to which we'll be adding the visualizations.
            this.attrDiv = dom.byId(this.container_id + "_attribs");
            this.eventDiv = dom.byId(this.container_id + "_events");
            this.timeDiv = dom.byId(this.container_id + "_timeline");
            this.scatterDiv = dom.byId(this.container_id + "_scatter");
            this.outcomeDiv = dom.byId(this.container_id + "_outcome");
            this.constraintDiv = dom.byId(this.container_id + "_constraints");

            // Initialize the attributes and events view.
            this.attributesAndEventsVis = new AttributesAndEventsView(this.container_id, this.container_id + "_attribs", this.container_id + "_events");
            this.attributesAndEventsVis.init(this.data.stats);
            this.attributesAndEventsVis.on("filter", lang.hitch(this, this.filterCallback));
            this.attributesAndEventsVis.on("milestone", lang.hitch(this, this.milestoneCallback));

            // Initialize the constraints.
            this.initConstraints();

            // Initialize the timeline.
            this.timeDiv.innerHTML='';
            this.timelineVis = new Timeline(this.container_id+"_timeline", 0, 0.25);
            this.timelineVis.init(this.data.timeline);
            this.timelineVis.on("select", lang.hitch(this, this.selectCallback));
            this.timelineVis.on("filter", lang.hitch(this, this.filterCallback));

            // Initialize the event scatter plot
            this.scatterDiv.innerHTML='';
            this.scatterVis = new EventOutcomeScatterView(this.container_id+"_scatter");
            this.scatterVis.init(this.data.stats);
            this.scatterVis.on("filter", lang.hitch(this, this.filterCallback));
            this.scatterVis.on("milestone", lang.hitch(this, this.milestoneCallback));

            // Initialize the KM outcomes plot.
            this.outcomeDiv.innerHTML='';
            this.outcomeVis = new KMOutcomeView(this.container_id+"_outcome");
            this.outcomeVis.init(this.data.stats);
            this.outcomeVis.on("filter", lang.hitch(this, this.filterCallback));
            this.outcomeVis.on("milestone", lang.hitch(this, this.milestoneCallback));
        }


        update(new_data) {
            this.data = new_data;
            this.render();
        }

        // The render function, which should update all elements of this visualization.
        render() {

            // Update the attributes and events view.
            this.attributesAndEventsVis.update(this.data.stats);

            // Update the timeline.
            this.timelineVis.update(this.data.timeline);

            // Update the outcomes.
            this.scatterVis.update(this.data.stats);
            this.outcomeVis.update(this.data.stats);
        }

        initConstraints() {
            if (this.data.attrConstr === undefined) {
                let new_div = domConstruct.toDom("<div class='constraint-box'>None</div>");
                this.constraintDiv.append(new_div);
            }
            else {
                this.traverseConstraints(this.data.attrConstr);
            }
        }

        traverseConstraints(_constraints) {
            if (_constraints.a === undefined) {
                let type = _constraints.type.code;
                let val = _constraints.value;
                let new_div = domConstruct.toDom("<div class='constraint-box'>" + type + " = " + val + "</div>");
                this.constraintDiv.append(new_div);
            }
            else {
                this.traverseConstraints(_constraints.a);
                this.traverseConstraints(_constraints.b);
            }
        }

        // Callback for events of subcomponents which can trigger filters. This should "bubble up" the event for the
        // larger system to respond.
        filterCallback(args) {
            // Append the cohort id.
            args.cohort = this.data.id;
            this.dispatch.call("filter", this, args);
        }

        // Milestones must be sent back to the server, which will update the timeline structure.
        milestoneCallback(args) {
            // Append the cohort id to the arguments.
            args.cohort = this.data.id;

            // Append the selected timeline element id to the arguments.
            args.timelineelement = this.timelineVis.getSelectedElement();

            if (args.timelineelement.id == null) {
                // Generate an error to indicate that something should be selected within the timeline.
                cadence.dialogs.showError("You must use the timeline view to select the location for the new milestone.");
            }
            else {
                // Contact the server.
                cadence.postRequest("milestone", args, this, this.handleMilestoneResponse);
            }
        }

        handleMilestoneResponse(_args) {
            this.update(_args.cohort);
        }

        selectCallback(args) {
            // Update the scatter plot.
            if (args === null) {
                // Update with the overall cohort.
                this.attributesAndEventsVis.update(this.data.stats);
                this.scatterVis.update(this.data.stats);
                this.outcomeVis.update(this.data.stats);
            }
            else {
                // Update with the selection.
                this.attributesAndEventsVis.update(args.stats);
                this.scatterVis.update(args.stats);
                this.outcomeVis.update(args.stats);
            }
        }

        // update distances matrix for node icons
        updateDistances(new_distances){
            this.nodeVis.updateDistances(new_distances);
        }

        updateNodeIcon(_baselineCohort,_currentCohort){
            if(_baselineCohort ===null || _currentCohort===null){
                this.nodeVis.updateIcon(this.data.baseline,this.data.focus);
            }
            else{
                this.nodeVis.updateIcon(_baselineCohort,_currentCohort);
            }
        }

        updateOutcomeColormapRange(min, max) {
            this.timelineVis.updateOutcomeColormapRange(min, max);
        }

        updateCorrelationColormapRange(min, max) {
            this.scatterVis.updateCorrelationColormapRange(min, max);
        }

        setScatterPlotOption(parameter, value) {
            this.scatterVis.setOption(parameter, value);
        }

    }
})
