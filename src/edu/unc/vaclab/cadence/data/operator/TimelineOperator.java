package edu.unc.vaclab.cadence.data.operator;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.data.timeline.ConstraintMilestone;
import edu.unc.vaclab.cadence.data.timeline.Milestone;
import edu.unc.vaclab.cadence.data.timeline.Pathway;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.Collection;
import java.util.Map;


public class TimelineOperator extends Operator implements JSONSerializable {

    private TimelineFilterDescriptor filterDescriptor = null;

    public TimelineOperator(Integer timeline_element_id, String timeline_element_type, Cohort initial_cohort) {
        super();

        // Save a reference to the initial cohort
        parentCohort = initial_cohort;

        // Get the keys for the included entities.
        Collection<String> included_entity_ids =  null;
        if (timeline_element_type.equals("pathway")) {
            // Obtain a reference to the timeline element that is the focus of this filter.
            Pathway _pathway = initial_cohort.getTimeline().getPathway(timeline_element_id);

            // Store the operator attributes, derived from the timeline element.
            filterDescriptor = new TimelineFilterDescriptor(_pathway);

            // Get the list of IDs that must go to the new cohort
            included_entity_ids = _pathway.getSpans().keySet();
        }
        else {
            // Obtain a reference to the timeline element that is the focus of this filter.
            Milestone _milestone = initial_cohort.getTimeline().getMilestone(timeline_element_id);

            // Store the operator attributes, derived from the timeline element.
            if (_milestone instanceof ConstraintMilestone) {
                filterDescriptor = new TimelineFilterDescriptor((ConstraintMilestone)_milestone);
            }

            // Get the list of IDs that must go to the new cohort
            included_entity_ids = _milestone.getSpans().keySet();
        }

        // Create the included and excluded cohorts
        Query inc_cohort_constraints = new Query(parentCohort.getCohortConstraints());
        Query ex_cohort_constraints = new Query(parentCohort.getCohortConstraints());
        incCohort = new Cohort(inc_cohort_constraints);
        exCohort = new Cohort(ex_cohort_constraints);

        // Now that the included IDs have been determined, we need to create the new cohorts (included and excluded).
        Map<String, Entity> entityMap = parentCohort.getEntities();
        Map<String, EventSpan> spanMap = parentCohort.getSpans();
        Map<String, Outcome> outcomeMap = parentCohort.getOutcomes();

        for(Map.Entry<String,Entity> e:entityMap.entrySet()){
            if (included_entity_ids.contains(e.getKey())) {
                Entity _entity = e.getValue();
                incCohort.putEntity(e.getKey(), _entity);
                incCohort.putSpan(e.getKey(), spanMap.get(e.getKey()));
                incCohort.putOutcome(e.getKey(),outcomeMap.get(e.getKey()));
            } else {
                Entity _entity = e.getValue();
                exCohort.putEntity(e.getKey(), _entity);
                exCohort.putSpan(e.getKey(), spanMap.get(e.getKey()));
                exCohort.putOutcome(e.getKey(),outcomeMap.get(e.getKey()));
            }
        }

        // Update cohort flags as required.
        incCohort.setFocus(true);
        exCohort.setExcluded(true);

        // Clone the timeline to the new cohort with the correct entity ids.
        incCohort.cloneTimeline(initial_cohort.getTimeline());
        exCohort.cloneTimeline(initial_cohort.getTimeline());

        // Extract the temporal constraints from the cloned timelines and store as the query constraints for
        // the respective cohorts.
        incCohort.getCohortConstraints().replaceTimeConstraintsFromTimeline(incCohort.getTimeline());
        exCohort.getCohortConstraints().replaceTimeConstraintsFromTimeline(exCohort.getTimeline());

        // Finally, connect this operator to the cohorts
        parentCohort.putOperator(this);
        incCohort.setParentOperator(this);
        exCohort.setParentOperator(this);
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = super.toJSON();
        if (filterDescriptor != null) {
            _json.put("constraint", filterDescriptor.toJSON());
        }
        return _json;
    }
}
