package edu.unc.vaclab.cadence.query;

import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ExclusionConstraint extends Constraint {
    private List<Constraint> excludedConstraints;

    public ExclusionConstraint(List<Constraint> excluded_constraints) {
        excludedConstraints = excluded_constraints;
    }

    public List<Constraint> getExcludedConstraints() {
        return excludedConstraints;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        JSONArray types_json = new JSONArray();
        for (Constraint _constraint : excludedConstraints) {
            types_json.add(_constraint.toJSON());
        }
        _json.put("excluded", types_json);
        return _json;
    }

    public Constraint deepCopy() {
        ExclusionConstraint _copy = new ExclusionConstraint(new ArrayList<>(this.excludedConstraints));
        return _copy;
    }
}
