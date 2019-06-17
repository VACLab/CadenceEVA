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
    "dojo/aspect",
    "cadence/vis/components/AttributeCatView",
    "cadence/vis/components/AttributeIntView",
    "cadence/vis/components/EventHistogram",
    "vaclab/VaclabVis"
], (declare, lang, dom, domConstruct, domStyle, dojoOn, registry, Menu, MenuItem, aspect, AttributeCatView, AttributeIntView, EventHistogram, VaclabVis) => {
    return class extends VaclabVis {

        constructor(dom_container_id, attr_container_id, event_container_id) {
            super(dom_container_id, ["filter", "milestone"]);

            // Store the container ID.
            this.containerID = dom_container_id;

            // Store the elements for the two individual parts of this view.
            this.attrDiv = dom.byId(attr_container_id);
            this.eventDiv = dom.byId(event_container_id);
        }

        resize(width, height) {
            // Store the new size.
            this.width = width;
            this.height = height;

            // Trigger a re-render
            this.render();
        }

        init(init_data) {
            // Store a reference to the stats data.
            this.data = init_data;

            this.render();
        }


        update(new_data) {
            // Store a reference to the data.
            this.data = new_data;

            this.render();
        }

        render() {
            // Update the attributes.
            this.attrDiv.innerHTML='';

            // Add size and outcome data.
            let new_div = domConstruct.toDom("<div style='margin-bottom: 4px; width:100%;'><span style='font-weight: normal; font-size:12px;'>Size</span><br/><span style='font-weight: normal; font-size:8px;'>"+numeral(this.data.size).format("0,0")+" ("+(this.data.avgoutcome*100).toFixed(0)+"% with outcome)</span></div>");
            this.attrDiv.append(new_div);

            let attrs = this.data.attrs;
            let size = this.data.size;
            for (let attr_name in attrs) {
                // Create a div for this attribute.
                let uid = cadence.uidGenerator();
                new_div = domConstruct.toDom("<div id='"+uid+"' style='width:100%;'></div>");
                this.attrDiv.append(new_div);

                // Render the attribute data within the new div.
                let attribute_data = attrs[attr_name];
                if (attribute_data.type.type === 'string') {
                    let _vis = new AttributeCatView(uid);
                    _vis.init(attribute_data, size);
                    _vis.on("filter", lang.hitch(this, this.filterCallback));
                }
                else {
                    let _vis = new AttributeIntView(uid);
                    _vis.init(attribute_data);
                    _vis.on("filter", lang.hitch(this, this.filterCallback));
                }
            }

            // Update the events.
            let _vis = new EventHistogram(this.eventDiv);
            _vis.init(this.data.events);
            _vis.on("filter", lang.hitch(this, this.filterCallback));
            _vis.on("milestone", lang.hitch(this, this.milestoneCallback));
        }

        filterCallback(args) {
            // Bubble up the filter.
            this.dispatcher.call("filter", this, args);
        }

        milestoneCallback(args) {
            // Bubble up the milestone.
            this.dispatcher.call("milestone", this, args);
        }
    }
});
