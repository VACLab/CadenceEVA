package edu.unc.vaclab.cadence.data.operator;

import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.data.timeline.ConstraintMilestone;
import edu.unc.vaclab.cadence.data.timeline.Milestone;
import edu.unc.vaclab.cadence.data.timeline.Pathway;
import edu.unc.vaclab.cadence.query.Constraint;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.List;

public class TimelineFilterDescriptor implements JSONSerializable {

    private Constraint srcConstraint = null;
    private Constraint destConstraint = null;
    private List<Constraint> exclusionConstraintList = null;

    private Constraint milestoneConstraint = null;

    /**
     * Constructor for a timeline pathway filter operation.
     * @param _pathway
     */
    public TimelineFilterDescriptor(Pathway _pathway) {
        Milestone _src = _pathway.getSource();
        if (_src instanceof ConstraintMilestone) {
            srcConstraint = ((ConstraintMilestone) _src).getConstraint();
        }
        Milestone _dest = _pathway.getDestination();
        if (_dest instanceof ConstraintMilestone) {
            destConstraint = ((ConstraintMilestone) _dest).getConstraint();
        }
        exclusionConstraintList = _pathway.getExclusionConstraints();
    }

    /**
     * Constructor for a timeline milestone filter operation.
     * @param _milestone
     */
    public TimelineFilterDescriptor(ConstraintMilestone _milestone) {
        milestoneConstraint = _milestone.getConstraint();
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        // Serialize the filter information.  Which values are provided depends upon the type of filter:
        // milestone or pathway.  Therefore, we need to check and only serialize non-null values.
        if (srcConstraint != null) {
            _json.put("src", srcConstraint.toJSON());
        }
        if (exclusionConstraintList != null) {
            JSONArray ex_list = new JSONArray();
            for (Constraint ex_constraint : exclusionConstraintList) {
                ex_list.add(ex_constraint.toJSON());
            }
            _json.put("excluded", ex_list);
        }
        if (destConstraint != null) {
            _json.put("dest", destConstraint.toJSON());
        }
        if (milestoneConstraint != null) {
            _json.put("constraint", milestoneConstraint.toJSON());
        }

        return _json;
    }
}
