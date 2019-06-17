package edu.unc.vaclab.cadence.data.operator;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.query.AttributeConstraint;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;


public class DataTypeOperator extends Operator implements JSONSerializable {
    private DataType dataType;
    private Object value;

    public DataTypeOperator(DataType data_type, Object _value, Cohort initial_cohort) {
        super();

        // Save a reference to the initial cohort
        parentCohort = initial_cohort;

        dataType = data_type;
        value = _value;

        // Create the included and excluded cohorts
        Query inc_cohort_constraints = new Query(parentCohort.getCohortConstraints());
        Query ex_cohort_constraints = new Query(parentCohort.getCohortConstraints());
        if (data_type instanceof AttributedDataType) {
            inc_cohort_constraints.addToAttributeConstraints((AttributedDataType)data_type, AttributeConstraint.AttributeOperator.EQUAL, Comparator.naturalOrder(), _value);
            ex_cohort_constraints.addToAttributeConstraints((AttributedDataType)data_type, AttributeConstraint.AttributeOperator.NOT_EQUAL, Comparator.naturalOrder(), _value);
        }
        incCohort = new Cohort(inc_cohort_constraints);
        exCohort = new Cohort(ex_cohort_constraints);

        // Apply operator to create resulting cohort.
        List<String> included_entity_ids = new ArrayList<>();

        // The filter could either be an attribute constraint or a data type constraint.
        if(dataType instanceof AttributedDataType){
            // Check to see if this is an integer constraint first.
            if (((AttributedDataType) dataType).getValueType().equals("int")) {
                // Note that this does not yet support range filters.  Support for ranges would need to be added
                // to this section.  For now, it looks for an exact integer match.
                for(Entity e:parentCohort.getEntities().values()) {
                    if (e.getAttributes().get(data_type) == _value) {
                        included_entity_ids.add(e.getID());
                    }
                }
            }
            // If the type is not one of the above, treat it as a categorical string value.
            else {
                // It is categorical.  Check each entity for a match.
                for(Entity e:parentCohort.getEntities().values()){
                    if (e.getAttributes().get(data_type).equals(_value)) {
                        included_entity_ids.add(e.getID());
                    }
                }
            }
        }
        else{
            // Filter by the event type.
            for(String _id :parentCohort.getEntities().keySet()){
                // Get the entity event list and span.
                List<Event> event_list = parentCohort.getEntities().get(_id).getEventList();
                EventSpan _span = parentCohort.getSpans().get(_id);

                // Now iterate over the span looking for a matching type.
                for (int i=_span.getStart(); i<_span.getEnd(); i++) {
                    if (event_list.get(i).getType().isEqualToOrChildOf(data_type)) {
                        included_entity_ids.add(_id);
                    }
                }
            }

        }

        // Now that the included IDs have been determined, we need to create the new cohorts (included and excluded).
        Map<String,Entity> entityMap = parentCohort.getEntities();
        Map<String,EventSpan> spanMap = parentCohort.getSpans();
        Map<String,Outcome> outcomeMap = parentCohort.getOutcomes();

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
        exCohort.setExcluded(true);

        // Clone the timeline to the new cohort with the correct entity ids.
        incCohort.cloneTimeline(initial_cohort.getTimeline());
        exCohort.cloneTimeline(initial_cohort.getTimeline());

        // Finally, connect this operator to the cohorts
        parentCohort.putOperator(this);
        incCohort.setParentOperator(this);
        exCohort.setParentOperator(this);
    }

    public Object getValue() {
        return value;
    }

    public DataType getType() {
        return dataType;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = super.toJSON();

        _json.put("type", dataType.toJSON());
        _json.put("value", value);

        return _json;
    }
}
