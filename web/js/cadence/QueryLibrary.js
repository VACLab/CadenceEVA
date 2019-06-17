"use strict"
define([
    "cadence/data/AttributeConstraint",
    "cadence/data/QueryConstraint",
    "cadence/data/QueryRelation",
    "dojo/dom-construct",
    "dojo/dom",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/query",
    "dojo/parser",
    "dojo/dnd/Source",
    "dijit/registry",
    "dijit/form/DateTextBox",
    "dijit/form/Select",
    "dijit/form/TextBox",
    "dijit/form/NumberTextBox",
    "dojo/NodeList-traverse"
], (AttributeConstraint, QueryConstraint, QueryRelation, domConstruct, dom, domClass, domStyle, query, parser, Source, registry, DateTextBox, Select, TextBox, NumberTextBox) => {
    return class {

        constructor(_cadence) {
            this.cadence = _cadence;
        }

        init(init_vocab_data, init_time_data, init_attribute_data) {
            // Get the cadence reference, to use in inline code.
            var cadence = this.cadence;

            this.vocablist = new Source("vocabulary_dnd_source", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' category='"+item.data.category+"' code='"+item.data.code+"'>"+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["vocab"]};
                        return obj_to_return;
                    }
                    else {
                        var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' treestate='folded' category='"+item.data.category+"' code='"+item.data.code+"' onclick='cadence.query.expandVocabulary(this);'><img class='tree-symbol' src='img/arrow-right.svg'> "+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["vocab"]};
                        return obj_to_return;
                    }
                },
                accept: [],
                copyOnly: true

            });
            this.vocablist.insertNodes(false, init_vocab_data);

            this.attributelist = new Source("attribute_dnd_source", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var label = item.data.label;
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' label='"+label+"'>"+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["attribute"]};
                        return obj_to_return;
                    }
                    else {
                        var label = item.data.label;
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' label='"+label+"'><img class='tree-symbol' src='img/circle.svg'> "+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["attribute"]};
                        return obj_to_return;
                    }
                },
                accept: [],
                copyOnly: true

            });
            this.attributelist.insertNodes(false, init_attribute_data);


            this.timelist = new Source("time_dnd_source", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var label = item.data.label;
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' label='"+label+"'>"+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["time"]};
                        return obj_to_return;
                    }
                    else {
                        var label = item.data.label;
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' label='"+label+"'><img class='tree-symbol' src='img/circle.svg'> "+label+"</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: ["time"]};
                        return obj_to_return;
                    }
                },
                accept: [],
                copyOnly: true

            });
            this.timelist.insertNodes(false, init_time_data);

            this.querytarget = new Source("query_dnd_target", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var new_html;
                        if (item.type[0] === 'time') {
                            var label = item.data.label;
                            new_html = "<div title='"+label+"' class='dojoDndItem query-item' type='"+label+"'> "+label+"</div>";
                        }
                        else {
                            var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                            new_html = "<div title='"+label+"' class='dojoDndItem invisible' type='vocab' category='"+item.data.category+"' code='"+item.data.code+"'> "+label+"</div>";
                        }
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: item.type};
                        return obj_to_return;
                    }
                    else {
                        var new_node;
                        if (item.type[0] === 'time') {
                            if (item.data.label === 'Specific Date') {
                                var label = item.data.label;
                                var uid = cadence.uidGenerator();
                                var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='"+label+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'> "+label+": </div>";

                                new_node = domConstruct.toDom(new_html);
                                var date_picker = new DateTextBox({value: new Date(), name:"newdate", width: "150px"});
                                new_node.appendChild(date_picker.domNode);
                            }
                            else {
                                var label = item.data.label;
                                var uid = cadence.uidGenerator();
                                var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='"+label+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'>  "+label+":<br/></div>";
                                new_node = domConstruct.toDom(new_html);
                                var relation_select = new Select({name: 'name', options: [
                                        {label:"&gt;", value:"THEN_BEYOND", selected: true},
                                        {label:"=", value:"THEN_EQUAL"},
                                        {label:"&lt;", value:"THEN_WITHIN"}
                                    ]});
                                new_node.appendChild(relation_select.domNode);
                                var time_box = new TextBox({name: 'name'});
                                domStyle.set(time_box.domNode, "width", "5em");
                                new_node.appendChild(time_box.domNode);
                                new_node.appendChild(domConstruct.toDom("&nbsp;Days"));
                            }
                        }
                        else {
                            var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                            var uid = cadence.uidGenerator();
                            var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='vocab' category='"+item.data.category+"' code='"+item.data.code+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'>  "+label+"</div>";
                            new_node = domConstruct.toDom(new_html);
                        }
                        var obj_to_return = { node: new_node, data: item, type: item.type};
                        return obj_to_return;
                    }
                },
                skipForm: true,
                accept: ["vocab", "time"]
            });

            this.attributetarget = new Source("attribute_dnd_target", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var new_html;
                        var label = item.data.label;
                        new_html = "<div title='"+label+"' class='dojoDndItem query-item' type='"+label+"'> "+label+"</div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: item.type};
                        return obj_to_return;
                    }
                    else {
                        // Is this an integer type or a categorical type?
                        if (item.data.type === 'int') {
                            var label = item.data.label;
                            var code = item.data.code;
                            var uid = cadence.uidGenerator();
                            var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' data_type='int' type='"+code+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'> "+label+": </div>";
                            new_node = domConstruct.toDom(new_html);

                            var relation_select = new Select({name: 'name', options: [
                                    {label:"&gt;", value:"gt", selected: true},
                                    {label:"=", value:"eq"},
                                    {label:"&lt;", value:"lt"}
                                ]});
                            new_node.appendChild(relation_select.domNode);

                            var text_box = new NumberTextBox({value: 0, name:"newintbox"});
                            domStyle.set(text_box.domNode, "width", "5em");
                            new_node.appendChild(text_box.domNode);

                            var obj_to_return = { node: new_node, data: item, type: item.type};
                            return obj_to_return;
                        }
                        else {
                            var label = item.data.label;
                            var code = item.data.code;
                            var uid = cadence.uidGenerator();
                            var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' data_type='string' type='"+code+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'> "+label+": </div>";
                            new_node = domConstruct.toDom(new_html);

                            // Get the domain options for this categorical value.
                            var domains = item.data.domain.split(',').map(function(d) {
                                return {label:d, value:d};
                            });
                            var attribute_select = new Select({name: 'name', options: domains});
                            new_node.appendChild(attribute_select.domNode);

                            var obj_to_return = { node: new_node, data: item, type: item.type};
                            return obj_to_return;
                        }
                    }
                },
                skipForm: true,
                accept: ["attribute"]
            });

            this.outcometarget = new Source("outcome_dnd_target", {
                creator: function(item, hint) {
                    if (hint === 'avatar') {
                        var new_html;
                        if (item.type[0] === 'time') {
                            var label = item.data.label;
                            new_html = "<div title='"+label+"' class='dojoDndItem query-item' type='"+label+"'> "+label+"</div>";
                        }
                        else {
                            var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                            new_html = "<div title='"+label+"' class='dojoDndItem invisible' category='"+item.data.category+"' code='"+item.data.code+"'> "+label+"</div>";
                        }
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = { node: new_node, data: item, type: item.type};
                        return obj_to_return;
                    }
                    else {
                        var new_node;
                        if (item.type[0] === 'time') {
                            if (item.data.label === 'Specific Date') {
                                var label = item.data.label;
                                var uid = cadence.uidGenerator();
                                var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='"+label+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'> "+label+": </div>";

                                new_node = domConstruct.toDom(new_html);
                                var date_picker = new DateTextBox({value: new Date(), name:"newdate", width: "150px"});
                                new_node.appendChild(date_picker.domNode);
                            }
                            else {
                                var label = item.data.label;
                                var uid = cadence.uidGenerator();
                                var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='"+label+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'>  "+label+":<br/></div>";
                                new_node = domConstruct.toDom(new_html);
                                var relation_select = new Select({name: 'name', options: [
                                        {label:"&gt;", value:"THEN_BEYOND", selected: true},
                                        {label:"=", value:"THEN_EQUAL"},
                                        {label:"&lt;", value:"THEN_WITHIN"}
                                    ]});
                                new_node.appendChild(relation_select.domNode);
                                var time_box = new TextBox({name: 'name'});
                                domStyle.set(time_box.domNode, "width", "5em");
                                new_node.appendChild(time_box.domNode);
                                new_node.appendChild(domConstruct.toDom("&nbsp;Days"));
                            }
                        }
                        else {
                            var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                            var uid = cadence.uidGenerator();
                            var new_html = "<div title='"+label+"' id='"+uid+"' class='dojoDndItem query-item' type='vocab' category='"+item.data.category+"' code='"+item.data.code+"'><img style='float:right; height:12px; width:12px;' src='/img/trash.svg' onclick='require([\"dojo/dom-construct\"], function(domConstruct) { console.log(\"YOUYOU\"); domConstruct.destroy(\""+uid+"\"); });'>  "+label+"</div>";
                            new_node = domConstruct.toDom(new_html);
                        }
                        var obj_to_return = { node: new_node, data: item, type: item.type};
                        return obj_to_return;
                    }
                },
                skipForm: true,
                accept: ["vocab", "time"]
            });
        }

        expandVocabulary(elem) {
            if (elem.getAttribute("treestate") == "folded") {
                // Change the state to expanded.
                elem.setAttribute("treestate", "expanded");

                // Update the image.
                var symbol_img = query(".tree-symbol", elem)[0];
                symbol_img.src = "/img/arrow-down.svg";

                // Make the request to get data.
                var cat = elem.getAttribute("category");
                var code = elem.getAttribute("code");
                var args = {
                    request_type: "children",
                    cat: cat,
                    code: code
                };
                this.elementToExpand = elem;
                this.cadence.postRequest("vocab", args, this, this.expandVocabularyHandler, false);
            }
            else {
                var expansion_parent = query(".left-pad", elem.parentElement)[0];
                domConstruct.empty(expansion_parent);
                elem.setAttribute("treestate", "folded");

                // Update the image.
                var symbol_img = query(".tree-symbol", elem)[0];
                symbol_img.src = "/img/arrow-right.svg";
            }

        }

        expandVocabularyHandler(_data) {
            // Sort children by code.
            _data.children.sort(function (a, b) {
                if (a.code < b.code)
                    return -1;
                else if (a.code > b.code) return 1;
                else
                    return 0;
            });

            var expansion_parent = query(".left-pad", this.elementToExpand.parentElement)[0];

            // Now create an invisible container and convert it into a nested drag and drop source.
            var new_html = "<div class='invisible' data-dojo-type='dojo/dnd/Source'></div>";
            var new_dom = domConstruct.toDom(new_html);
            domConstruct.place(new_dom, expansion_parent, "last");
            var new_source = new Source(new_dom, {
                creator: function (item, hint) {
                    if (hint === 'avatar') {
                        var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                        var new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' category='" + item.data.category + "' code='" + item.data.code + "'>" + label + "</div><div class='left-pad'></div></div>";
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = {node: new_node, data: item, type: ["vocab"]};
                        return obj_to_return;
                    }
                    else {
                        var label = (item.data.label ? item.data.code + ": " + item.data.label : item.data.category);
                        var new_html;
                        if (item.data.leaf) {
                            new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' treestate='folded' category='" + item.data.category + "' code='" + item.data.code + "'><img class='tree-symbol' src='img/circle.svg'> " + label + "</div><div class='left-pad'></div></div>";
                        }
                        else {
                            new_html = "<div class='invisible'><div title='"+label+"' class='dojoDndItem vocab-box' treestate='folded' category='" + item.data.category + "' code='" + item.data.code + "' onclick='cadence.query.expandVocabulary(this);'><img class='tree-symbol' src='img/arrow-right.svg'> " + label + "</div><div class='left-pad'></div></div>";
                        }
                        var new_node = domConstruct.toDom(new_html);
                        var obj_to_return = {node: new_node, data: item, type: ["vocab"]};
                        return obj_to_return;
                    }
                },
                accept: [],
                copyOnly: true
            });

            // Finally, add the child items to this source.
            var new_vocab_data = []
            for (var i = 0; i < _data.children.length; i++) {
                var _child = _data.children[i];
                new_vocab_data.push({data: {category: _child.cat, code: _child.code, label: _child.label, leaf: _child.leaf}, type: ["vocab"]});
            }
            new_source.insertNodes(false, new_vocab_data);
        }

        searchBrowserVocabularyRecursiveHelper(search_term, _node) {
            // Are there any children?  If so, recurse.
            var show_node = false;
            var next_tier = _node.children[1].children[0];
            if (next_tier != null) {
                // We only recurse if this node has children...
                for (var i=0; i<next_tier.children.length; i++) {
                    var show_child = this.searchBrowserVocabularyRecursiveHelper(search_term, next_tier.children[i]);
                    if (show_child) {
                        show_node = true;
                    }
                }
            }

            // Now check this node itself.
            if (_node.childNodes[0].childNodes[1].nodeValue.toUpperCase().includes(search_term)) {
                show_node = true;
            }

            // Finally, update this node's class to reflect if it is hidden or not.
            if (show_node) {
                dojo.removeClass(_node, "hidden");
            }
            else {
                dojo.addClass(_node, "hidden");
            }

            return show_node;
        }

        searchBrowserVocabulary(search_term) {
            search_term = search_term.toUpperCase();

            // Get access to dom container for all vocabulary items.
            var vocab_container = dojo.byId("vocabulary_dnd_source");
            console.log(vocab_container);
            console.log(vocab_container.children);
            console.log("Starting recursion...");

            // Search recursively, adding the "hidden" class as appropriate.
            var this_lib = this;
            for (var i=0; i<vocab_container.children.length; i++) {
                this_lib.searchBrowserVocabularyRecursiveHelper(search_term, vocab_container.children[i]);
            }

            console.log("Done");
        }

        runQuery() {
            var query_nodes = dojo.byId("query_dnd_target").childNodes;
            var query_spec = (query_nodes.length == 0 ? null : this.extractConstraints([].slice.call(query_nodes)));

            var attribute_nodes = dojo.byId("attribute_dnd_target").childNodes;
            var attribute_spec = (attribute_nodes.length == 0 ? null : this.extractConstraints([].slice.call(attribute_nodes)));

            var outcome_nodes = dojo.byId("outcome_dnd_target").childNodes;
            var outcome_spec = (outcome_nodes.length == 0 ? null : this.extractConstraints([].slice.call(outcome_nodes)));

            var full_spec = {};
            if (query_spec != null) {
                full_spec.query = query_spec;
            }
            if (attribute_spec != null) {
                full_spec.attribute = attribute_spec;
            }
            if (outcome_spec != null) {
                full_spec.outcome = outcome_spec;
            }
            dojo.byId("jsondata").value = JSON.stringify(full_spec);
        }

        // Recursive function to extract constraints from the DOM and return as a javascript object.
        extractConstraints(dom_node_list) {
            // The first node will be either a time gap, or not...  We deal with different types in different ways.
            // Is this a time gap?
            var first_node_type = dom_node_list[0].getAttribute("type");
            if (first_node_type === 'Time Gap') {
                // Make a recursive call, if needed.
                var _remainder = null;
                if (dom_node_list.length > 1) {
                    _remainder = this.extractConstraints(dom_node_list.slice(1,dom_node_list.length));
                }
                var widget_list = registry.findWidgets(dom_node_list[0]);
                var gap_type = widget_list[0].value;
                var _duration = widget_list[1].value;
                var _relation = new QueryRelation(gap_type, null, _remainder, _duration);
                return _relation;
            }
            else {
                // If we have a specific date, an attribute, or a specific event type, we need to do similar things.  First, create a
                // query constraint for the first item in the node list.  This first step does vary a bit by type...
                var _constraint = null;
                if (first_node_type === 'Specific Date') {
                    // The first node is a specific date.  Get the date value, and create the needed data structures.
                    var date_value = registry.findWidgets(dom_node_list[0])[0].value;

                    _constraint = new QueryConstraint("Specific Date", date_value);
                }
                else if (dom_node_list[0].getAttribute("category") === null) {
                    // It isn't an event... it must be an attribute.  What is the data type?
                    var data_type = dom_node_list[0].getAttribute("data_type");
                    if (data_type === "int") {
                        var relation_type = registry.findWidgets(dom_node_list[0])[0].value;
                        var attrib_value = registry.findWidgets(dom_node_list[0])[1].value;
                        _constraint = new AttributeConstraint(first_node_type, attrib_value, data_type, relation_type);
                    }
                    else {
                        var attrib_value = registry.findWidgets(dom_node_list[0])[0].value;
                        _constraint = new AttributeConstraint(first_node_type, attrib_value, data_type, 'eq');
                    }
                }
                else {
                    var _cat = dom_node_list[0].getAttribute("category");
                    var _code = dom_node_list[0].getAttribute("code");
                    _constraint = new QueryConstraint(_cat, _code);
                }

                // We now have the constraint object for the very first node.  We need to see first if this is the very
                // last item.  If so, we can just return the constraint.
                var length = dom_node_list.length;
                if (length == 1) {
                    return _constraint;
                }
                else {
                    // Now we need to see if the "next" dom node is a Time Gap.  If so, we have extra work to do.
                    if (dom_node_list[1].getAttribute("type") === 'Time Gap') {
                        // We have a time gap!  First, recurse by skipping TWO nodes (only if the node list is long enough).
                        var _remainder = null;
                        if (length > 2) {
                            _remainder = this.extractConstraints(dom_node_list.slice(2,length));
                        }
                        // Now compose a relation to pull the two parts together, using the time gap values.
                        var widget_list = registry.findWidgets(dom_node_list[1]);
                        var gap_type = widget_list[0].value;
                        var _duration = widget_list[1].value;
                        var _relation = new QueryRelation(gap_type, _constraint, _remainder, _duration);
                        return _relation;
                    }
                    else {
                        // If we reach this point, the dom node list has additional items, the first of which is something
                        // other than a time gap.  So we simply recurse and compose the two constraint objects via a "THEN"
                        // relation.
                        var _remainder = this.extractConstraints(dom_node_list.slice(1,length));
                        var _relation = new QueryRelation("THEN", _constraint, _remainder, null);
                        return _relation;
                    }
                }
            }
        }
    }
});

