"use strict"
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/request/xhr",
    "dojo/json",
    "cadence/DialogLibrary",
    "cadence/QueryLibrary",
    "cadence/VisualizationLibrary"
], (declare, lang, xhr, json, DialogLibrary, QueryLibrary, VisualizationLibrary) => {
    return class {

        constructor(includeQuery = false, includeVis = false) {
            this.dialogs = new DialogLibrary(this);

            // Only include the query components when asked.
            if (includeQuery) {
                this.query = new QueryLibrary(this);
            }

            // Only include the visualization components when asked.
            if (includeVis) {
                this.vis = new VisualizationLibrary(this);
            }

            // A globally unique ID generator for Cadence.  Resets each time webpage is loaded.
            this.uid = 0;
        }

        uidGenerator() {
            this.uid += 1;
            return 'cad_id_' + this.uid;
        }

        postRequest(command, args, context = this, handler = this.handleResponse, showWaitPrompt = true, waitPrompt = "A request is being processed. Please wait.") {
            var this_dialogs = this.dialogs;
            if (showWaitPrompt) {
                this_dialogs.showWait(waitPrompt);
            }
            var data_obj = {command: command, args: args};
            var postArgs = {
                data: json.stringify(data_obj),
                handleAs: "json",
                headers: {"Content-Type": "application/json"},
                method: "post"
            };
            var handler_func = lang.hitch(context, handler);
            xhr("/request", postArgs).then(function (data) {
                    if (showWaitPrompt) {
                        this_dialogs.hideWait();
                    }
                    handler_func(data);
                },
                lang.hitch(this, this.handleError));
        }

        handleResponse(data) {
            this.dialogs.showDialog("Success", data.response);
        }

        handleError() {
            this.dialogs.hideWait();
            this.dialogs.showDialog("Failure", "The request failed with an error.");
        }

        setCohortTreeOption(parameter, value) {
            this.vis.setCohortTreeOption(parameter, value);
        }

        setCohortComparisonOption(parameter, value) {
            this.vis.setCohortComparisonOption(parameter, value);
        }

        setIciclePlotOption(parameter, value) {
            this.vis.setIciclePlotOption(parameter, value);
        }

        setScatterPlotOption(parameter, value) {
            this.vis.setScatterPlotOption(parameter, value);
        }
    }
});

