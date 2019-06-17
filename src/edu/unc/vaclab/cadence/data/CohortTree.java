package edu.unc.vaclab.cadence.data;

import edu.unc.vaclab.cadence.data.distance.DistanceMap;
import edu.unc.vaclab.cadence.data.operator.DataTypeOperator;
import edu.unc.vaclab.cadence.data.operator.Operator;
import edu.unc.vaclab.cadence.data.operator.TimelineOperator;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class CohortTree implements JSONSerializable {

    private Map<Integer,Cohort> cohortIndex;
    private DistanceMap distanceMap;
    private Cohort root;

    public CohortTree(Cohort _root) {
        // Store the root.
        root = _root;
        root.setBaseline(true);

        // Create indices.
        cohortIndex = new HashMap<>();
        cohortIndex.put(root.getID(), root);

        // Create distance map
        distanceMap = new DistanceMap(root, cohortIndex);
    }

    /**
     * Filter by attribute
     * @return
     */
    public Integer filter(Integer cohort_id, DataType data_type, Object _value) {
        // Create the operator for this filter.  It will generate the new cohorts and expand the tree by linking
        // the parent and new cohorts.
        Operator _operator = new DataTypeOperator(data_type, _value, cohortIndex.get(cohort_id));

        // The Tree needs to index the newly created cohorts.
        Cohort inc_cohort = _operator.getIncCohort();
        cohortIndex.put(inc_cohort.getID(), inc_cohort);
        distanceMap.addCohort(inc_cohort);

        Cohort ex_cohort = _operator.getExCohort();
        cohortIndex.put(ex_cohort.getID(), ex_cohort);
        distanceMap.addCohort(ex_cohort);

        // Set focus to newly included cohort
        setFocus(inc_cohort.getID());

        // Return the new included cohort id.
        return inc_cohort.getID();
    }

    /**
     * Filter by timeline element.
     */
    public Integer filter(Integer cohort_id, Integer timeline_element_id, String timeline_element_type) {
        // Create the operator for this filter.
        Operator _operator = new TimelineOperator(timeline_element_id, timeline_element_type, cohortIndex.get(cohort_id));

        // Expand the cohort tree.
        Cohort inc_cohort = _operator.getIncCohort();
        cohortIndex.put(inc_cohort.getID(), inc_cohort);
        distanceMap.addCohort(inc_cohort);

        Cohort ex_cohort = _operator.getExCohort();
        cohortIndex.put(ex_cohort.getID(), ex_cohort);
        distanceMap.addCohort(ex_cohort);

        // Set focus to newly included cohort
        setFocus(inc_cohort.getID());

        // Return the new included cohort id.
        return inc_cohort.getID();
    }

    /**
     * Set the baseline cohort
     */
    public void setBaseline(Integer cohort_id) {
        // Clear current baseline
        for (Cohort cohort : cohortIndex.values()) {
            cohort.setBaseline(false);
        }

        // Set baseline and remove focus
        Cohort cohort = cohortIndex.get(cohort_id);
        cohort.setBaseline(true);
        cohort.setFocus(false);
    }

    /**
     * Set the focus cohort
     */
    public void setFocus(Integer cohort_id) {
        // Clear current focus
        for (Cohort cohort : cohortIndex.values()) {
            cohort.setFocus(false);
        }

        // Set focus
        cohortIndex.get(cohort_id).setFocus(true);
    }

    public Cohort getCohort(int _id) {
        return cohortIndex.get(_id);
    }

    public Cohort getRoot() {
        return root;
    }

    private Cohort getBaseline() {
        Optional<Cohort> baseline = cohortIndex.values().stream().filter(x -> x.getBaseline()).findFirst();

        return baseline.isPresent() ? baseline.get() : null;
    }

    private Cohort getFocus() {
        Optional<Cohort> focus = cohortIndex.values().stream().filter(x -> x.getFocus()).findFirst();

        return focus.isPresent() ? focus.get() : null;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        // Serialize the cohort index to a JSON object that maps IDs to Cohort JSON objects.
        JSONObject cohort_id_map = new JSONObject();
        for (Cohort _c : cohortIndex.values()) {
            cohort_id_map.put(String.valueOf(_c.getID()), _c.toJSON());
        }
        _json.put("cohorts", cohort_id_map);

        // Add a reference to the root.
        _json.put("root", root.getID());

        // Add the distances
        _json.put("distances", distanceMap.toJSON());

        Cohort baseline = getBaseline();
        Cohort focus = getFocus();

        // Add the baseline and focus
        if (baseline != null) _json.put("baseline", baseline.getID());
        if (focus != null) _json.put("focus", focus.getID());

        // Add the detailed distance between baseline and focus
        if (baseline != null && focus != null) {
            _json.put("focusDistance", distanceMap.getDistance(baseline.getID(), focus.getID()).toJSON());
        }

        return _json;
    }
}
