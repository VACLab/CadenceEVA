<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="edu.unc.vaclab.cadence.ApplicationState" %>
<%@ page import="edu.unc.vaclab.cadence.data.DataSet" %>
<%@ page import="edu.unc.vaclab.cadence.SessionState" %>
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
    // Pull up the active dataset, if one exists.
    DataSet _ds = session_state.getDataSet();

    // Get the query JSON.
    String query_json = request.getParameter("jsondata");
    request.setAttribute("query_json", query_json);
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
                cadence: "/js/cadence"
            }
        }
    </script>
    <script data-dojo-config="async:true" src="/js/dojo/dojo/dojo.js"></script>
</head>
<body class="flat">
<script>
    require(['dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'dijit/layout/AccordionContainer', "dijit/layout/TabContainer", "dijit/form/Button", "dijit/form/TextBox", "dijit/form/Select"]);
    require(['cadence/Cadence'], function(Cadence) {
        cadence = new Cadence(false, true);
    });
</script>
<div id="top-level-border" data-dojo-type="dijit/layout/BorderContainer" style="width: 100%; height: 100%; margin: 0; padding: 5px;">
    <div id="header" style="border:0; background-color:#ffffff;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
        <div style="float:right;"><a href="http://vaclab.web.unc.edu/"><img style="height:32px;" src="img/vaclab_logo.svg"></a></div>
        <div style="float: left; margin-top: 0px; margin-right: 4px;"><a href="index.jsp"><img src="img/cadence_logo.svg" style="height:32px"></a></div>
    </div>
    <div id="sidebar" style="border:0;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'leading', layoutPriority:1">
        <div data-dojo-type="dijit/layout/AccordionContainer">
            <div data-dojo-type="dijit/layout/ContentPane" title="Cohort">
                <h4 class="cohort-title">Cohort</h4>
                <div class="info-container">
                    <img class="info-icon" src="img/attribute.svg">
                    <div class="info-wrapper">
                        <p id="patient-num" style="text-align:center;"></p>
                    </div>
                </div>
                <div class="info-container">
                    <img class="info-icon" src="img/event.svg">
                    <div class="info-wrapper">
                        <p id="event-num" style="text-align:center;"></p>
                    </div>
                </div>
                <h4 class="cohort-title">Visualization</h4>
                <div class="info-container">
                    <img class="info-icon" src="img/label.svg">
                    <div class="info-wrapper">
                        <p><b>Size</b>: patient number</p>
                        <p><b>Shade</b>: normalized information gain</p>
                        <div style="float: left;" class="legend1"></div>
                        <p>Events in the cohort</p>
                        <div style="clear: both; float: left;" class="legend2"></div>
                        <p>Events have patients in common</p>
                        <button style="clear:both;text-align:center;display:block;" data-dojo-type="dijit/form/Button" onclick="cadence.vis.eventColorReset();">Event Color Reset</button>
                    </div>
                </div>
                <h4 class="cohort-title">Query</h4>
                <div class="info-container">
                    <img class="info-icon" src="img/query.svg">
                    <div class="info-wrapper">
                        <h5>Attributes in the query</h5>
                        <ul id="cohort-attrs"></ul>
                        <h5>Events in the query</h5>
                        <ul id="cohort-events"></ul>
                        <h5>Outcome event</h5>
                        <ul id="cohort-outcome"></ul>
                    </div>
                </div>
            </div>
            <div data-dojo-type="dijit/layout/ContentPane" title="Configuration">
                <table>
                    <tr><th>Dataset:</th><td><%= _ds == null ? "" : _ds.getName() %></td></tr>
                    <tr><th>Data Size:</th><td><%= _ds.getSize() %></td></tr>
                </table>
            </div>
        </div>
    </div>
    <div id="query-vis" style="border-radius:3px;width:55%; height:100%;" data-dojo-type="dijit/layout/BorderContainer" data-dojo-props="region:'leading', layoutPriority:2">
        <div id="query-flow" style="height:55%;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top',splitter: true">
            <div id="query-info" style="height: 35px;"><h4 class="vis-title">Events between the time window specified by the query</h4></div>
            <div id="query-flow-tab" data-dojo-type="dijit/layout/TabContainer" style="width: 100%; height: calc(100% - 35px);">
                <div id="flow-between-chart" data-dojo-type="dijit/layout/ContentPane" title="Query Flow" data-dojo-props="selected:true"></div>
                <div id="scatter-between-chart" data-dojo-type="dijit/layout/ContentPane" title="Scatter Chart"></div>
            </div>
        </div>
        <div id="event-before" style="width:50%;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'left'">
            <div id="event-before-info" style="height: 35px;"><h4 class="vis-title">Events before the time window specified by the query</h4></div>
            <div id="scatter-before-chart" style="height:calc(100% - 35px);"></div>
        </div>
        <div id="event-after" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
            <div id="event-after-info" style="height: 35px;"><h4 class="vis-title">Events after the time window specified by the query</h4></div>
            <div id="scatter-after-chart" style="height:calc(100% - 35px);"></div>
        </div>
    </div>
    <div id="control-vis" style="overflow:hidden; border-radius:3px;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
        <div id="dem-dist" style="height:30%; width:100%; overflow:hidden;" data-dojo-type="dijit/layout/BorderContainer" data-dojo-props="region:'top'">
            <div id="dist-info" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
                <h4 class="vis-title">Distribution</h4>
            </div>
            <div id="outcome-dist" style="overflow:hidden; width:50%;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'left'"></div>
            <div id="gender-dist" style="overflow:hidden;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'"></div>
        </div>
        <div id="event-search" style="overflow:hidden;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
            <h4 class="vis-title" style="margin-bottom:5px;">Events</h4>
            <label for="sort-by"><b>Sort by: </b></label>
            <select id="sort-by" style="margin-bottom:5px;" data-dojo-type="dijit/form/Select" name="sort-by">
                <option value="" selected="selected">Select an option to sort events</option>
                <option value="enum">Number of Events</option>
                <option value="pnum">Number of Patients</option>
                <option value="ig">Normalized Information Gain</option>
            </select>
            <input id="search-by" style="width:99%;margin-bottom:5px;" data-dojo-type="dijit/form/TextBox" name="search-by" value="" data-dojo-props="intermediateChanges:true, placeHolder: 'Type in to search event'">
            <div>
                <table class="event-table">
                    <tbody>
                    <tr style="border-bottom: 1px solid #2196f3;"><td width="50%">Event</td><td width="30%">Patient Number</td><td width="10%">Event Number</td><td width="10%">Normalized IG</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div id="event-dist" style="height: calc(70% - 150px);" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'bottom'"></div>
    </div>
</div>
<script>
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
            cadence.vis.init();
            <%
            }
            %>
            // Run this query
            var query_json = ${query_json};
            cadence.vis.drawVis(query_json);
        });
    });
</script>
</body>

</html>
