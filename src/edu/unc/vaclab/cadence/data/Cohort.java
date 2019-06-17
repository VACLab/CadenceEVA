package edu.unc.vaclab.cadence.data;

import edu.unc.vaclab.cadence.data.operator.Operator;
import edu.unc.vaclab.cadence.data.stats.CohortStats;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.*;

/**
 * Created by gotz on 7/14/17.
 */
public class Cohort implements JSONSerializable {

    private static int NEXT_ID = 0;
    private synchronized static int generateID() {
        return NEXT_ID++;
    }

    private int id;
    private Vocabulary vocabulary;
    private HashMap<String,Entity> entities;
    private HashMap<String,EventSpan> spans;
    private HashMap<String,Outcome> outcomes;
    private CohortStats stats;
    private boolean statRefreshNeeded;
    private Operator parentOperator;
    private ArrayList<Operator> operators;
    private boolean baseline;
    private boolean focus;
    private boolean isExcluded;
    private Timeline timeline;
    private Query cohortConstraints;

    public Cohort(Query cohort_constraints){
        cohortConstraints = cohort_constraints;
        id = generateID();
        entities = new HashMap<>();
        spans = new HashMap<>();
        outcomes = new HashMap<>();
        statRefreshNeeded = false;
        stats = new CohortStats();
        parentOperator = null;
        operators = new ArrayList<>();
        baseline = false;
        focus = false;
        isExcluded = false;
        timeline = null;
    }

    public Query getCohortConstraints() {
        return cohortConstraints;
    }

    public Map<String,Entity> getEntities() {
        return Collections.unmodifiableMap(entities);
    }

    public void putEntity(String _id, Entity _entity) {
        entities.put(_id, _entity);
        statRefreshNeeded = true;
    }

    public Map<String,EventSpan> getSpans() {
        return Collections.unmodifiableMap(spans);
    }

    public void putSpan(String _id, EventSpan _span) {
        spans.put(_id, _span);
        statRefreshNeeded = true;
    }

    public Map<String,Outcome> getOutcomes() {
        return Collections.unmodifiableMap(outcomes);
    }

    public void putOutcome(String _id, Outcome _outcome) {
        outcomes.put(_id, _outcome);
        statRefreshNeeded = true;
    }

    public CohortStats getStats() {
        if (statRefreshNeeded) {
            // Update the stats object.
            stats.update(this);
            statRefreshNeeded = false;
        }

        return stats;
    }

    public Timeline getTimeline() {
        if (timeline == null) {
            timeline = new Timeline(this);
            // Build the timeline if it hasn't yet been constructed.
        }
        return timeline;
    }

    public void cloneTimeline(Timeline timeline_to_clone) {
        timeline = timeline_to_clone.clone(this);
    }

    public int getID() {
        return id;
    }

    public void setParentOperator(Operator operator) { parentOperator = operator; }

    public void putOperator(Operator operator){
        operators.add(operator);
    }

    public ArrayList<Operator> getOperators() {
        return operators;
    }

    public void setBaseline (boolean _baseline) { baseline = _baseline; }
    public boolean getBaseline() { return baseline; }

    public void setFocus (boolean _focus){
        focus = _focus;
    }
    public boolean getFocus() { return focus; }

    public void setExcluded (boolean excluded) { isExcluded = excluded; }

    @Override
    public JSONObject toJSON() throws JSONException {

        JSONObject _json = new JSONObject();
        _json.put("id", id);
        _json.put("stats", getStats().toJSON());
        if (cohortConstraints.getAttributeConstraints() != null) {
            _json.put("attrConstr", cohortConstraints.getAttributeConstraints().toJSON());
        }
        if (cohortConstraints.getTemporalConstraints() != null) {
            _json.put("tempConstr", cohortConstraints.getTemporalConstraints().toJSON());
        }
        _json.put("outConst", this.cohortConstraints.getOutcomeConstraints().toJSON());
        _json.put("timeline", getTimeline().toJSON());
        JSONArray operatorJSON = new JSONArray();
        for (Operator o:operators) {
            operatorJSON.add(o.toJSON());
        }
        if (parentOperator != null) {
            _json.put("parentOperator", parentOperator.toJSON());
        }
        _json.put("operators", operatorJSON);
        _json.put("baseline", baseline);
        _json.put("focus", focus);
        _json.put("isExcluded", isExcluded);

        return _json;
    }
}
