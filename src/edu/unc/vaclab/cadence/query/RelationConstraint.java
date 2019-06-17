package edu.unc.vaclab.cadence.query;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.time.Duration;

public class RelationConstraint extends Constraint {

    public enum RelationType {
        THEN, THEN_WITHIN, THEN_EQUAL, THEN_BEYOND, OR
    }

    protected Constraint constraintA;
    protected Constraint constraintB;
    protected RelationType relationship;
    protected Duration timeConstraint;

    public RelationConstraint(Constraint constraint_a, RelationType _relationship, Duration time_constraint, Constraint constraint_b) {
        constraintA = constraint_a;
        relationship = _relationship;
        timeConstraint = time_constraint;
        constraintB = constraint_b;
    }

    public Constraint getConstraintA() {
        return constraintA;
    }

    public Constraint getConstraintB() {
        return constraintB;
    }

    public Duration getTimeConstraint() {
        return timeConstraint;
    }

    public RelationType getType() {
        return relationship;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        if (constraintA != null) {
            _json.put("a", constraintA.toJSON());
        }
        if (constraintB != null) {
            _json.put("b", constraintB.toJSON());
        }
        if (relationship != null) {
            _json.put("relation", relationship.toString());
        }
        if (timeConstraint != null) {
            _json.put("duration", timeConstraint.toMillis());
        }

        return _json;
    }

    public Constraint deepCopy() {

        RelationConstraint copy = new RelationConstraint(
                (this.constraintA != null ? this.constraintA.deepCopy() : null),
                this.relationship,
                this.timeConstraint,
                (this.constraintB != null ? this.constraintB.deepCopy() : null)
        );

        return copy;
    }

}
