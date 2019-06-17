package edu.unc.vaclab.cadence.servlet;

import edu.unc.vaclab.cadence.SessionState;
import org.apache.commons.json.JSON;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by gotz on 6/1/17.
 */
public abstract class CadenceServlet extends HttpServlet {

    public CadenceServlet() {
    }

    public void doGet(HttpServletRequest _request, HttpServletResponse _response) throws IOException {
        _response.sendError(400,"Invalid request method via GET.  All requests must be made via POST.");
        return;
    }

    public void doPost(HttpServletRequest _request, HttpServletResponse _response) throws IOException {
        // Retrieve the session state.
        SessionState session_state = (SessionState) _request.getSession().getAttribute(SessionState.SESSION_STATE_KEY);

        // Parse the JSON-based post body.
        JSONObject json_object = null;
        try {
            json_object = (JSONObject) JSON.parse(_request.getInputStream());
        } catch (JSONException e) {
            _response.sendError(400, "Invalid POST request.  A JSON parsing error occurred.");
            return;
        }

        // Handle the request according to the type of request being made.
        try {
            JSONObject response_obj = handle(session_state, json_object);
            _response.getWriter().write(response_obj.toString());
        } catch (JSONException e) {
            System.err.println("JSON Exception on server.");
            System.err.println(e);
            _response.sendError(400, "POST request failed due to an error processing JSON-format data.");
            return;
        }
    }

    public abstract JSONObject handle(SessionState session_state, JSONObject request_json_obj) throws JSONException;
}

