package edu.unc.vaclab.cadence.servlet;

import edu.unc.vaclab.cadence.SessionState;
import edu.unc.vaclab.cadence.data.AttributedDataType;
import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.CohortTree;
import edu.unc.vaclab.cadence.data.DataType;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.Iterator;
import java.util.List;

/**
 * Created by gotz on 6/1/17.
 */
public class GeneralRequestServlet extends CadenceServlet {

    public GeneralRequestServlet() {
    }

    public JSONObject handle(SessionState session_state, JSONObject request_json_obj) throws JSONException {

        String _command = request_json_obj.getString("command");
        JSONObject _args = request_json_obj.getJSONObject("args");

        if (_command.equals("vocab")) {
            return vocabHandler(session_state, _args);
        }
        else if (_command.equals("query")) {
            return queryHandler(session_state, _args);
        }
        else if (_command.equals("filter")) {
            return filterHandler(session_state, _args);
        }
        else if (_command.equals("milestone")) {
            return milestoneHandler(session_state, _args);
        }
        else if (_command.equals("close")) {
            return closeHandler(session_state, _args);
        }
        else if (_command.equals("baseline")) {
            return baselineHandler(session_state, _args);
        }
        else if (_command.equals("focus")) {
            return focusHandler(session_state, _args);
        }
        else {
            System.err.println("Unknown command received by GeneralRequestServlet.");
            return null;
        }
    }

    private JSONObject vocabHandler(SessionState session_state, JSONObject _args) throws JSONException {
        // The response depends on the type of vocabulary request.
        String request_type = _args.getString("request_type");

        if (request_type.equals("children")) {
            // Get the parent type information from the request.
            String _cat = _args.getString("cat");
            String _code = _args.getString("code");

            // Get all children for the given data type.
            Vocabulary _vocab = session_state.getDataSet().getVocabulary();
            List<DataType> _children = _vocab.getChildren(_cat, _code);

            // Map to JSON.
            JSONObject response_obj = new JSONObject();
            JSONArray children_json = new JSONArray();
            Iterator<DataType> _iter = _children.iterator();
            while (_iter.hasNext()) {
                DataType data_type = _iter.next();
                JSONObject one_child = data_type.toJSON();
                // See if this child is a leaf node.
                one_child.put("leaf", _vocab.isLeaf(data_type));
                children_json.add(one_child);
            }
            response_obj.put("children", children_json);
            return response_obj;
        }
        return null;
    }

    private JSONObject queryHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        // Run the query.
        Query query = new Query(_args, session_state.getDataSet().getVocabulary());
        Cohort cohort = session_state.getDataSet().getConnector().query(query);

        return response_obj;
    }

    private JSONObject milestoneHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        // Get the request parameters.
        int cohort_id = _args.getInt("cohort");
        JSONObject timeline_element = _args.getJSONObject("timelineelement");
        String element_type = timeline_element.getString("type");
        int element_id = timeline_element.getInt("id");

        // The parameters include the data type which is to be inserted as a new milestone.
        DataType data_type = null;
        Vocabulary _vocab = session_state.getDataSet().getVocabulary();
        JSONObject data_type_json = _args.getJSONObject("type");
        String _cat = data_type_json.getString("cat");
        String _code = data_type_json.getString("code");
        if (data_type_json.has("type")) {
            // This is an attributed data type.
            data_type = _vocab.getAttributedDataType(_cat, _code, null, null);
        }
        else {
            // This is not attributed, so it must be an event Data Type...
            data_type = _vocab.getEventType(_cat, _code);
        }

        // Get the timeline for which the milestone should be added.
        Cohort _cohort = session_state.getCohortTree().getCohort(cohort_id);
        Timeline timeline_to_modify = _cohort.getTimeline();

        // Insert the milestone!
        timeline_to_modify.insertMilestone(element_type, element_id, data_type);

        response_obj.put("cohort", _cohort.toJSON());

        return response_obj;
    }

    private JSONObject filterHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        // Is this a timeline filter request?
        if (_args.getString("type").equals("timeline")) {
            // Get the timeline element ID for the element that should be used for filtering.
            Integer timeline_element_id = null;
            String timeline_element_type = null;
            if (_args.has("element")) {
                if (_args.getJSONObject("element").has("id")) {
                    timeline_element_id = _args.getJSONObject("element").getInt("id");
                }
                if (_args.getJSONObject("element").has("type")) {
                    timeline_element_type = _args.getJSONObject("element").getString("type");
                }
            }

            // Finally, get the id of the cohort that is to be filtered.
            Integer cohort_id = null;
            if (_args.has("cohort")) {
                cohort_id = _args.getInt("cohort");
            }

            CohortTree cohort_tree = session_state.getCohortTree();

            // Perform the filter.
            Integer new_cohort_id = cohort_tree.filter(cohort_id,timeline_element_id,timeline_element_type);

            // Return the updated cohort tree, and the new cohort ID.
            response_obj.put("cohortTree", session_state.getCohortTree().toJSON());
            response_obj.put("newCohortID", new_cohort_id);
        }
        else {
            // Retrieve the specified data type object from the dataset vocabulary.
            // To do that, we have to see if this is an attributed data type or not.
            DataType data_type = null;
            Vocabulary _vocab = session_state.getDataSet().getVocabulary();
            JSONObject data_type_json = _args.getJSONObject("type");
            String _cat = data_type_json.getString("cat");
            String _code = data_type_json.getString("code");
            if (data_type_json.has("type")) {
                // This is an attributed data type.
                data_type = _vocab.getAttributedDataType(_cat, _code, null, null);
            }
            else {
                // This is not attributed, so it must be an event Data Type...
                data_type = _vocab.getEventType(_cat, _code);
            }

            // Get the value for the filter, if one is provided (should only be for attributed data types).
            Object _value = null;
            if (_args.has("val")) {
                String string_value = _args.getString("val");

                // The data is provided as a string via HTTP.  If the DataType calls for another type of value we need to convert it.
                if (((AttributedDataType)data_type).getValueType().equals("int")) {
                    _value = Integer.parseInt(string_value);
                }
                else {
                    _value = string_value;
                }
            }

            // Finally, get the id of the cohort that is to be filtered.
            Integer cohort_id = null;
            if (_args.has("cohort")) {
                cohort_id = _args.getInt("cohort");
            }

            System.out.println("====== FILTER ===============");
            System.out.println("COHORT ID: " + cohort_id);
            System.out.println("DATA TYPE: " + data_type.getLabel());
            System.out.println("VALUE: " + _value);
            System.out.println("=============================");

            CohortTree cohort_tree = session_state.getCohortTree();

            // Perform the filter.
            Integer new_cohort_id = cohort_tree.filter(cohort_id,data_type,_value);

            // Return the updated cohort tree, and the new cohort ID.
            response_obj.put("cohortTree", session_state.getCohortTree().toJSON());
            response_obj.put("newCohortID", new_cohort_id);
        }

        return response_obj;
    }

    private JSONObject closeHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        System.out.println("STARTING CLOSE...");
        System.out.flush();

        // Retrieve the cohort ID.
        Integer _id = _args.getInt("id");

        System.out.println("==> TURNING OFF FOCUS...");
        System.out.flush();

        // TODO: Allow closing of baseline, forcing a switch to a different baseline, or don't allow this?

        // Turn off focus on the specified cohort.
        // session_state.getCohortTree().getCohort(_id).setFocus(false);

        System.out.println("==> PRODUCING JSON...");
        System.out.flush();

        // Return the updated cohort tree and the closed cohort id.
        response_obj.put("cohortTree", session_state.getCohortTree().toJSON());
        response_obj.put("closedID", _id);

        System.out.println("DONE WITH CLOSE.");
        System.out.flush();

        return response_obj;
    }

    private JSONObject baselineHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        System.out.println("STARTING BASELINE...");

        session_state.getCohortTree().setBaseline(_args.getInt("id"));

        System.out.println("DONE WITH BASELINE.");

        // Return the updated cohort tree
        response_obj.put("cohortTree", session_state.getCohortTree().toJSON());

        return response_obj;
    }

    private JSONObject focusHandler(SessionState session_state, JSONObject _args) throws JSONException {
        JSONObject response_obj = new JSONObject();

        System.out.println("STARTING FOCUS...");

        session_state.getCohortTree().setFocus(_args.getInt("id"));

        System.out.println("DONE WITH FOCUS.");

        // Return the updated cohort tree
        response_obj.put("cohortTree", session_state.getCohortTree().toJSON());

        return response_obj;
    }
}

