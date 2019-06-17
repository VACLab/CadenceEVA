<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="edu.unc.vaclab.cadence.ApplicationState" %>
<%@ page import="edu.unc.vaclab.cadence.SessionState" %>
<%@ page import="edu.unc.vaclab.cadence.data.Cohort" %>
<%@ page import="edu.unc.vaclab.cadence.data.CohortTree" %>
<%@ page import="edu.unc.vaclab.cadence.data.DataSet" %>
<%@ page import="edu.unc.vaclab.cadence.query.Query" %>
<%@ page import="org.apache.commons.json.JSONException" %>
<%@ page import="org.apache.commons.json.JSONObject" %>
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

    // Redirect if there is no dataset.
    CohortTree cohort_tree = null;
    String query_json = null;
    Query query_obj = null;

    if (_ds != null) {

        // Get the query JSON.
        query_json = request.getParameter("jsondata");

        if (query_json != null) {
            try {
                // Run the query.
                JSONObject json_obj = new JSONObject(query_json);
                query_obj = new Query(json_obj, _ds.getVocabulary());
                Cohort _cohort = _ds.getConnector().query(query_obj);
                if (_cohort != null) {
                    cohort_tree = new CohortTree(_cohort);
                    session_state.setCohortTree(cohort_tree);
                }
            }
            catch(JSONException e) {
                // TODO: More error handling?
                %>
                <jsp:include page="/error.jsp" />
                <%
            }
        }
    }

    if (cohort_tree == null) {
        %>
        <jsp:include page="/error.jsp" />
        <%
    }
    else {
%>
<html>
<head>
    <title>Cadence | UNC VACLab</title>
    <link rel="stylesheet" href="/js/dojo/themes/flat/flat.css">
    <link rel="stylesheet" href="/css/cadence.css">
    <script src="/js/d3/d3.min.js"></script>
    <script type="text/javascript" src="/js/d3-hexbin.v0.2.min.js"></script>
    <script type="text/javascript" src="/js/d3kit.js"></script>
    <script type="text/javascript" src="/js/d3kit.js"></script>
    <script type="text/javascript" src="/js/d3-tip.js"></script>
    <script type="text/javascript" src="/js/d3-interpolate-path.js"></script>
    <script type="text/javascript" src="/js/numeral.min.js"></script>
    <script type="text/javascript" src="/js/optimization.js"></script>
    <link rel="icon"
          type="image/png"
          href="img/cadence_logo.svg">
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
    require(['dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'dijit/Tooltip', 'dijit/layout/AccordionContainer']);
    require(['cadence/Cadence'], function(Cadence) {
        cadence = new Cadence(false, true);
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
            cadence.vis.init(<%= cohort_tree.toJSON() %>);
            <%
        }
    %>
        });
    });
</script>
<div id="top-level-border" data-dojo-type="dijit/layout/BorderContainer" style="width: 100%; height: 100%; margin: 0px; padding: 0px;">
    <div id="header" style="border:0px solid gray; background-color:#ffffff;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
        <div style="float:right;"><a href="http://vaclab.web.unc.edu/"><img style="height:32px;" src="img/vaclab_logo.svg"></a></div>
        <div style="float: left; margin-top: 0px; margin-right: 4px;"><a href="index.jsp"><img src="img/cadence_logo.svg" style="height:32px"></a></div>
    </div>
    <div id="sidebar" style="border:0; width:20%" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'left'">
        <div data-dojo-type="dijit/layout/AccordionContainer">
            <div id="cohort_overview_vis_container" data-dojo-type="dijit/layout/ContentPane" title="Cohort Overview"></div>
            <div data-dojo-type="dijit/layout/ContentPane" title="Configuration">
                <table>
                    <tr><th>Dataset:</th><td><%= _ds == null ? "" : _ds.getName() %></td></tr>
                    <tr><th>Query Spec:</th><td><%= query_json %></td></tr>
                    <tr><th>Cohort Size:</th><td><%= cohort_tree.getRoot().getEntities().size() %></td></tr>
                </table>
            </div>
        </div>
    </div>
    <div id="center_panel" style="overflow:auto; margin:0; padding:0; border:0;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
        <div id="cohort_vis_border_container" data-dojo-type="dijit/layout/BorderContainer" style="width: 100%; height: 100%; margin: 0px; padding: 0px;">
            <div id="visheader" style="border:0px solid gray; background-color:#ffffff;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
                <div>
                    <span style="font-size: smaller ;">
                    Outcome: <%= query_obj.getOutcomeConstraints().toString() %> after episode
                    </span>
                    <div style="margin-right:20px; float:right; font-size:8pt;">&nbsp;0.25</div>
                    <div style="float:right;" id="scatterplot_legend_container"></div>
                    <div style="float:right; font-size:8pt;">Scatterplot: -0.25&nbsp;</div>
                    <div style="margin-right:130px; float:right; font-size:8pt;">&nbsp;100%</div>
                    <div style="float:right;" id="timeline_legend_container"></div>
                    <div style="float:right; font-size:8pt;">Timeline: 0%&nbsp;</div>
                </div>
            </div>
            <div id="outer_cohort_details_vis_container" style="overflow:auto; margin:0; padding:0; border:0;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
                <div id="cohort_details_vis_container" style="overflow:auto;">
                    <div id="panel_container_1" style="margin: 0 5px 0 0; box-shadow: 3px 3px #aaaaaa; height: 450px; max-height: 450px; overflow:hidden; padding:3px; border:1px solid gray;" data-dojo-type="dijit/layout/ContentPane"> </div>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</body>
</html>

<%
}   // End of else clause allowing normal operation if three is no error during the init process for this page.
%>
