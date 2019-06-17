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
    "cadence/vis/components/AttributeList",
    "cadence/vis/components/EventList"
], (declare, lang, dom, domConstruct, domStyle, dojoOn, registry, Menu, MenuItem, aspect, AttributeList, EventList) => {
    return class {
        constructor(dom_container_id) {
            this.dispatch = d3.dispatch("selectAttribute", "selectEvent");

            // Add the visual elements for this visualization.
            this.container_id = dom_container_id;

            let container = dom.byId(dom_container_id);

            container.innerHTML=
                "<div style='font-weight: normal; font-size: 10px; height: 100%; display: flex; flex-direction: column;'>" +
                    "<div>Attributes</div>" +
                    "<div id='"+dom_container_id+"_attributes' style='margin-bottom: 5px; flex: 0 0 auto'></div>" +
                    "<div>Events</div>" +
                    "<div id='"+dom_container_id+"_events' style='padding-left: 5px; flex: 1; display: flex'></div>" +
                "</div>";
        }

        on(event_name, event_handler) {
            this.dispatch.on(event_name, event_handler);
        }

        init(init_data) {
            let self = this;

            // Store a reference to the data.
            this.data = init_data;

            // We have data, and the vis has been populated with containers during construction.  To init, store refs
            // to the individual container divs to which we'll be adding the visualizations.
            let attributes_container_id = this.container_id + "_attributes";
            this.attributeDiv = dom.byId(attributes_container_id);

            let events_container_id = this.container_id + "_events";
            this.eventsDiv = dom.byId(events_container_id);

            // Create the attributes visualization
            this.attributeList = new AttributeList(attributes_container_id);
            this.attributeList.on("select", lang.hitch(self, self.selectAttributeCallback));
            this.attributeList.init(this.data);

            // Create the event visualizations
            this.eventLists = {};
            this.data.eventGroups.forEach(function(d, i) {
                let groupId = events_container_id + "_" + d.cat;

                let flex = "1 0 auto";

                let style = "'width: 0px; padding-right: 5px; flex: " + flex + "; display: flex; flex-direction: column;";
                style += i === 0 ? "'" : " margin-left: 10px;'";

                let div = domConstruct.place(
                    "<div style=" + style + ">" +
                        "<div>" + d.cat + "</div>" +
                    "<div id="+groupId+" style='height: 0px; overflow-y: auto; flex: 1'></div>" +
                    "</div>",
                    self.eventsDiv, "last");

                self.eventsDiv.append(div);

                let eventList = new EventList(groupId, i === 0);
                eventList.on("select", lang.hitch(self, self.selectEventCallback));

                self.eventLists[d.cat] = eventList;

                eventList.init({
                    root: d.root,
                    constraints: self.data.constraints,
                    range: self.data.range
                });
            });

            this.render();
        }

        update(update_data) {
            // Store a reference to the data
            this.data = update_data;

            this.render();
        }

        // The render function, which should update all elements of this visualization.
        render() {
            // Update the visualizations
            this.attributeList.update(this.data);

            let self = this;
            this.data.eventGroups.forEach(function(d) {
               self.eventLists[d.cat].update({
                   root: d.root,
                   constraints: self.data.constraints,
                   range: self.data.range
               });
            });
        }

        selectAttribute(attribute) {
            this.attributeList.selectAttribute(attribute);

            for (const cat in this.eventLists) {
                this.eventLists[cat].selectEvent(null);
            }
        }

        selectEvent(event) {
            this.attributeList.selectAttribute(null);

            for (const cat in this.eventLists) {
                if (event && event.cat === cat) {
                    this.eventLists[cat].selectEvent(event);
                }
                else {
                    this.eventLists[cat].selectEvent(null);
                }
            }
        }

        setGradientThreshold(threshold) {
            for (const cat in this.eventLists) {
                this.eventLists[cat].setGradientThreshold(threshold);
            }
        }

        setOption(parameter, value) {
            for (const cat in this.eventLists) {
                this.eventLists[cat].setOption(parameter, value);
            }
        }

        // Callback for events of subcomponents. This should "bubble up" the event for the larger system to respond.
        selectAttributeCallback(args) {
            this.dispatch.call("selectAttribute", this, args);
        }

        selectEventCallback(args) {
            this.dispatch.call("selectEvent", this, args);
        }
    }
})
