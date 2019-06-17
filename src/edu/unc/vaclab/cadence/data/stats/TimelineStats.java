package edu.unc.vaclab.cadence.data.stats;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;
import org.apache.commons.math3.stat.descriptive.moment.Mean;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Created by gotz on 7/14/17.
 */
public abstract class TimelineStats extends GenericStats implements JSONSerializable {

    private Mean meanEngine;
    private double duration;
    private Timeline timeline;
    private Map<String,EventSpan> spans;

    public TimelineStats(Timeline _timeline, Map<String,EventSpan> _spans) {
        initBlankStats();
        meanEngine = new Mean();
        duration = 0;
        timeline = _timeline;
        spans = _spans;
    }

    public void computeStats() {
        // Get the number of entities.
        size = spans.size();

        // Creating locations to store vectors that will be used to compute correlations and durations.
        Map<DataType,double[]> type_vectors = new HashMap<>();
        double[] outcome_vector = new double[size];
        double[] duration_vector = new double[size];

        // Get the average outcome the set of timeline element.
        Map<String,Outcome> cohort_outcomes = new HashMap<>(timeline.getCohort().getOutcomes());
        cohort_outcomes.keySet().retainAll(spans.keySet());
        long out_count = 0;
        double out_total = 0;
        for (Outcome _outcome : cohort_outcomes.values()) {
            out_total += _outcome.getValue();
            out_count++;
        }
        avgOutcome = (float)(out_total/out_count);

        // Get the list of entities for this timeline element.
        Map<String,Entity> _entities = new HashMap<>(timeline.getCohort().getEntities());
        _entities.keySet().retainAll(spans.keySet());

        // Iterate over spans to get aggregate stats for both attributes and events.  We also compute the duration of the span.
        int entity_index = 0;
        for (Entity _entity : _entities.values()) {
            // STEP A:
            // Update outcome vector.
            outcome_vector[entity_index] = cohort_outcomes.get(_entity.getID()).getValue();

            // STEP B:
            // Update aggregate stats for each attribute
            computeAggregateStatsForAttributes(_entity);

            // STEP C:
            // Update aggregate stats for each event type.
            // Begin by getting the event span for this entity.
            EventSpan _span = spans.get(_entity.getID());
            List<Event> events_in_span = _entity.getEventList().subList(_span.getStart(), Math.min(_entity.getEventList().size(),_span.getEnd()));

            // Now iterate over the sublist, updating the stats for each one we encounter.
            Set<DataType> unique_types_and_parents = computeEventAndParentCountStats(events_in_span);

            // STEP D: Now compute vectors for all of these events (both observed, and parent types in the hierarchy).
            for (DataType _type : unique_types_and_parents) {
                double[] _vector = type_vectors.computeIfAbsent(_type, (k) -> new double[size]);
                _vector[entity_index] = 1;
            }

            // STEP E: Next, compute duration based on the span.
            duration_vector[entity_index] = determineDurationForEntity(_entity, _span);

            // Increment the entity index before moving on to the next entity in the cohort.
            entity_index += 1;
        }

        // Now that all entities have been inspected, compute correlations.
        computeCorrelations(type_vectors, outcome_vector);

        // Determine information gain-based cut through type hierarchy.
        identifyInformativeTypes(type_vectors, outcome_vector);

        // Determine the scenting of events in the tree
        identifyScentingRank();

        // Find Similar events
        //identifySimilarTypes(type_vectors);

        // Also the outcomes by time after the queried event span for each entity.
        computeOutcomesByTimeAfter(cohort_outcomes.values());

        // Also compute average duration.
        duration = meanEngine.evaluate(duration_vector);

        return;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = super.toJSON();
        _json.put("duration", duration);
        return _json;
    }

    protected abstract double determineDurationForEntity(Entity _entity, EventSpan _span);
}
