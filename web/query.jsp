<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="edu.unc.vaclab.cadence.ApplicationState" %>
<%@ page import="edu.unc.vaclab.cadence.data.DataSet" %>
<%@ page import="edu.unc.vaclab.cadence.SessionState" %>
<%@ page import="edu.unc.vaclab.cadence.data.DataType" %>
<%@ page import="java.util.Iterator" %>
<%@ page import="edu.unc.vaclab.cadence.data.AttributedDataType" %>
<%
    HttpSession _session = request.getSession();
    ServletContext _context = _session.getServletContext();
    ApplicationState app_state = (ApplicationState)_context.getAttribute(ApplicationState.APPLICATION_STATE_KEY);
    if (app_state == null) {
        app_state = ApplicationState.getInstance(_context);
        _context.setAttribute(ApplicationState.APPLICATION_STATE_KEY, app_state);
    }
    SessionState session_state = (SessionState)_session.getAttribute(SessionState.SESSION_STATE_KEY);
    if (session_state == null) {
        session_state = new SessionState(app_state);
        _session.setAttribute(SessionState.SESSION_STATE_KEY, session_state);
    }
    // Datasets are stored as part of the application state so that we only have one instance of each dataset at a time,
    // regardless of how many user sessions are active.
    String ds_id = request.getParameter("dataset");
    DataSet _ds = null;
    if (ds_id != null) {
        // If a new datset has been specified, connect to it.
        _ds = app_state.getDataset(ds_id);

        // We ensure that we're connected to the dataset, and that a reference to the session's dataset is stored within
        // the session state.
        if (_ds != null) {
            _ds.connect();
            session_state.setDataSet(_ds);
        }
    }
    else {
        // If a dataset is not specified as a parameter, retrieve the existing dataset for the session (if available)
        _ds = session_state.getDataSet();
    }

    if (_ds == null) {
        %>
        <jsp:include page="/error.jsp" />
        <%
    }
    else {
        // Get the initial vocabulary list.
        Iterator<DataType> data_type_iter = _ds.getVocabulary().getRootTypes().iterator();

        // Get the initial attribute list.
        Iterator<AttributedDataType> attribute_iter = _ds.getVocabulary().getAttributeTypes().iterator();
%>
<html>
<head>
<title>Cadence | UNC VACLab</title>
    <!--link rel="stylesheet" href="/js/dojo/dijit/themes/tundra/tundra.css"-->
    <link rel="stylesheet" href="/js/dojo/themes/flat/flat.css">
    <link rel="stylesheet" href="/css/cadence.css">
    <script src="/js/d3/d3.min.js"></script>
    <script type="text/javascript" src="/js/d3kit.js"></script>
    <script type="text/javascript" src="/js/d3-tip.js"></script>

    <script>
        dojoConfig = {
            async: true,
            parseOnLoad: true,
            paths: {
                cadence: "/js/cadence",
                vaclab: "/js/vaclab"
            }
        }
    </script>
    <script data-dojo-config="async:true" src="/js/dojo/dojo/dojo.js"></script>
</head>
<body class="flat">
<script>
    require(['dojo/dnd/Source', 'dijit/form/DateTextBox', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'dijit/Tooltip', 'dijit/layout/AccordionContainer']);
    require(['cadence/Cadence'], function(Cadence) {
        cadence = new Cadence(true, false);
    });

    require(["dojo/ready"], function(ready){
        ready(function(){
            <%
                if (_ds == null) {
                    %>
                    cadence.dialogs.showError("The dataset is invalid.  <a href='index.jsp'>Click here</a> to begin a new session.");
                    <%
                }
                else {
                    %>
                    var init_vocab_data = [];
                    var attribute_data = [];
                    <%
                    // Iterate over root event types in the vocabulary.
                    while (data_type_iter.hasNext()) {
                        DataType _type = data_type_iter.next();
                        %>
                        init_vocab_data.push({data: {category:"<%= _type.getCategory() %>", code:"<%= _type.getCode() %>"}, type: ["vocab"]});
                        <%
                    }

                    // Also iterate over attributes from the vocabulary.
                    while (attribute_iter.hasNext()) {
                        AttributedDataType attr_type =attribute_iter.next();
                        // What is the datatype for this attribute?
                        if (attr_type.getValueType().equals("string")) {
                            // Convert the list of domain values to a comma sep list.
                            Iterator<String> domain_iter = attr_type.getValueDomain().iterator();
                            String domain_vals = domain_iter.next();
                            while (domain_iter.hasNext()) {
                                domain_vals += "," + domain_iter.next();
                            }
                            %>
                            attribute_data.push({data: {category:"<%= attr_type.getCategory() %>", code:"<%= attr_type.getCode() %>", type:"string", domain:"<%= domain_vals %>", label:"<%= attr_type.getLabel() %>"}, type: ["attribute"]});
                            <%
                        }
                        else if (attr_type.getValueType().equals("int")) {
                            %>
                            attribute_data.push({data: {category:"<%= attr_type.getCategory() %>", code:"<%= attr_type.getCode() %>", type:"int", label:"<%= attr_type.getLabel() %>"}, type: ["attribute"]});
                            <%
                        }
                    }
                    %>
                    var time_data = [
                        {data: {label: "Specific Date"}, type: ["time"]},
                        {data: {label: "Time Gap"}, type: ["time"]},
                    ];
                    cadence.query.init(init_vocab_data, time_data, attribute_data);
                    <%
                }
            %>
        });
    });
</script>
<div id="top-level-border" data-dojo-type="dijit/layout/BorderContainer" style="width: 100%; height: 100%; margin: 0px; padding: 0px;">
    <div id="header" style="border-bottom:0px solid gray; background-color:#ffffff;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
        <div style="float:right;"><a href="http://vaclab.web.unc.edu/"><img style="height:32px;" src="img/vaclab_logo.svg"></a></div>
        <div style="float: left; margin-top: 0px; margin-right: 4px;"><a href="index.jsp"><img src="img/cadence_logo.svg" style="height:32px"></a></div>
    </div>
    <div id="sidebar-wide" style="border:0;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'left'">
        <div data-dojo-type="dijit/layout/AccordionContainer">
            <div data-dojo-type="dijit/layout/ContentPane" title="Vocabularies">
                <div style="font-style: italic; font-size: small;">Search:&nbsp;<input oninput="cadence.query.searchBrowserVocabulary(this.value);"></input></div>
                <div style="height: 100%; overflow: auto;">
                    <div class="invisible" id="vocabulary_dnd_source">
                    </div>
                </div>
            </div>
            <div data-dojo-type="dijit/layout/ContentPane" title="Time Constraints">
                <div class="invisible" id="time_dnd_source">
                </div>
            </div>
            <div data-dojo-type="dijit/layout/ContentPane" title="Attribute Constraints">
                <div class="invisible" id="attribute_dnd_source">
                </div>
            </div>
        </div>
    </div>
    <div id="example_vis" style="overflow:hidden; margin:0; padding:0; border:0;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
        <p>
            Define your query for this dataset by dragging items from the sidebar to the areas below.  Press the Run Query button when your query has been defined.
        </p>
        <p>
            <table style="height: 100px">
                    <tr>
                        <td>
                            <div style="padding: 5px; background-color: #dddddd; width: 310px; height: 100%">
                                <b>Temporal Constraints:</b>
                                <div id="query_dnd_target" style="background-color: #dddddd; width: 310px; min-height: 100px;"></div>
                            </div>
                        </td>
                        <td rowspan="2">
                            <div style="padding: 5px; background-color: #dddddd; width: 310px; height: 100%;">
                                <table style="padding: 0; margin: 0; border-collapse: collapse; height: 100%;">
                                    <tr style="height: 16px;"><td>
                                        <b>Outcome Label:</b>
                                    </td></tr>
                                    <tr><td>
                                        <div id="outcome_dnd_target" style="display: block; background-color: #dddddd; width: 310px; height: 100%; min-height: 100px;"></div>
                                    </td></tr>
                                </table>
                            </div>
                        </td>
                        <td rowspan="2">
                            <div data-dojo-type="dijit/form/Form" id="query_form" data-dojo-id="query_form" action="/vis.jsp" method="post">
                                <input data-dojo-type="dijit/form/TextBox" type="hidden" id="jsondata" name="jsondata" value="">
                                <button id="querybutton" onclick="cadence.query.runQuery();" data-dojo-type="dijit/form/Button" type="submit">Run Query</button>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding: 5px; background-color: #dddddd; width: 310px; height: 100%">
                                <b>Attribute Constraints:</b>
                                <div id="attribute_dnd_target" style="background-color: #dddddd; width: 310px; min-height: 100px;"></div>
                            </div>
                        </td>
                    </tr>
            </table>
        </p>
        <p></p>
        <script>
            function runAdvancedQuery(json_query) {
                document.getElementById("advanced_jsondata_text_field").value = json_query;
                document.advanced_query_form.submit();
            }

            function advancedQueryInit() {
                document.getElementById("advanced_query_container").style.display = "inline";
            }
        </script>
        <p><span onclick="advancedQueryInit();">Click to activate advanced mode...</span>
            <div id="advanced_query_container" style="display: none;">
            <form name="advanced_query_form" action="/vis.jsp" method="post">
                <input id="advanced_jsondata_text_field" type="text" name="jsondata"/>
                <button type="submit">Run Advanced Query</button>
            </form>
            <br>
            Reference Queries:
            <table cellspacing="5px" style="border: 1px solid black;">
                <tr><td><b>Dataset</b></td><td><b>Query</b></td><td></td></tr>
                <tr><td><a href="/query.jsp?dataset=dmreal">dmreal</a></td><td>One year->I50 HF->One year | Outcome=N17 Acute Kidney Failure</td><td><button onclick="runAdvancedQuery('{\'query\':{\'type\':\'THEN_BEYOND\',\'right\':{\'type\':\'THEN_BEYOND\',\'left\':{\'cat\':\'ICD10CM\',\'code\':\'I50\'},\'val\':\'365\'},\'val\':\'365\'},\'outcome\':{\'cat\':\'ICD10CM\',\'code\':\'N17\'}}');">Run</button></td></tr>
                <tr><td><a href="/query.jsp?dataset=hfreal">hfreal</a></td><td>Two years->pain in throat and chest -> 30 days | Outcome=Opiate Disorders</td><td><button onclick="runAdvancedQuery('{\'query\':{\'type\':\'THEN_EQUAL\',\'right\':{\'type\':\'THEN_EQUAL\',\'left\':{\'cat\':\'ICD10CM\',\'code\':\'R07\'},\'val\':\'30\'},\'val\':\'720\'},\'outcome\':{\'cat\':\'ICD10CM\',\'code\':\'F11\'}}');">Run</button></td></tr>
                <tr><td><a href="/query.jsp?dataset=hfreal">hfreal</a></td><td>Two years->CKD->one year | Outcome=Acute Kidney disease</td><td><button onclick="runAdvancedQuery('{\'query\':{\'type\':\'THEN_BEYOND\',\'right\':{\'type\':\'THEN_BEYOND\',\'left\':{\'cat\':\'ICD10CM\',\'code\':\'N18\'},\'val\':\'365\'},\'val\':\'720\'},\'outcome\':{\'cat\':\'ICD10CM\',\'code\':\'N17\'}}');">Run</button></td></tr>
                <tr><td><a href="/query.jsp?dataset=hfreal">hfreal</a></td><td>One year->Pain->Discharge | Outcome=Opiate Disorders</td><td><button onclick="runAdvancedQuery('{\'query\':{\'type\':\'THEN_BEYOND\',\'right\':{\'type\':\'THEN\',\'left\':{\'cat\':\'ICD10CM\',\'code\':\'G89\'},\'right\':{\'cat\':\'SNOMED\',\'code\':\'58000006\'}},\'val\':\'365\'},\'outcome\':{\'cat\':\'ICD10CM\',\'code\':\'F11\'}}');">Run</button></td></tr>
            </table>
            </div>
        </p>

    </div>
</div>
</body>

</html>
<%
    } // End of the else clause for the error checking logic for this page.
%>
