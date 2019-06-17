<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="edu.unc.vaclab.cadence.ApplicationState" %>
<%@ page import="edu.unc.vaclab.cadence.SessionState" %>
<%@ page import="edu.unc.vaclab.cadence.data.DataSet" %>
<%@ page import="java.util.Iterator" %>
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
%>
<html>
<head>
<title>Cadence | UNC VACLab</title>
    <!--link rel="stylesheet" href="/js/dojo/dijit/themes/tundra/tundra.css"-->
    <link rel="stylesheet" href="/js/dojo/themes/flat/flat.css">
    <link rel="stylesheet" href="/css/cadence.css">
    <script src="/js/d3/d3.min.js"></script>
    <script type="text/javascript" src="/js/d3kit.min.js"></script>
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
    require(['dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'dijit/layout/AccordionContainer']);
    require(['cadence/Cadence'], function(Cadence) {
        cadence = new Cadence();
    });
</script>
<div data-dojo-type="dijit/layout/BorderContainer" data-dojo-props="gutters:false" style="width: 100%; height: 100%; margin: 0px; padding: 0px;">
    <div id="header" style="border-bottom: 0px solid gray; background-color:#ffffff;" data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'top'">
        <div style="float:right;"><a href="http://vaclab.web.unc.edu/"><img style="height:32px;" src="img/vaclab_logo.svg"></a></div>
        <div style="float: left; margin-top: 0px; margin-right: 4px;"><a href="index.jsp"><img src="img/cadence_logo.svg" style="height:32px"></a></div>
    </div>
    <div data-dojo-type="dijit/layout/ContentPane" data-dojo-props="region:'center'">
        <center>
        Choose a dataset to begin.
        <p/>
        <%
            Iterator<DataSet> _iter = app_state.getDatasets().iterator();
            while (_iter.hasNext()) {
                DataSet _ds = _iter.next();
                %>
                <button onclick="window.location='query.jsp?dataset=<%=_ds.getID()%>'" data-dojo-type="dijit/form/Button" type="button"><%=_ds.getName()%></button><br/>
                <%
            }
        %>
        <img onclick="cadence.dialogs.showError('Uploading of data is not yet supported.');" style='height:32px; cursor:pointer;' src="img/plus.svg"/><br/>
        </center>
    </div>
</div>
</body>
</html>
