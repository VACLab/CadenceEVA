package edu.unc.vaclab.cadence.data.stats;

import edu.unc.vaclab.cadence.data.*;

import java.util.*;

/**
 * Created by gotz on 7/14/17.
 */
public class CohortStats extends GenericStats implements JSONSerializable {

    public CohortStats() {
        super();
    }

    public void update(Cohort _cohort) {
        // Start with a clean slate.
        this.initBlankStats();

        // Get the size of the cohort.
        size = _cohort.getEntities().size();

        // Creating locations to store vectors that will be used to compute correlations.
        Map<DataType,double[]> type_vectors = new HashMap<>();
        double[] outcome_vector = new double[size];

        // Get the average outcome for the entire cohort.
        Map<String, Outcome> cohort_outcomes = _cohort.getOutcomes();

        avgOutcome = (float)cohort_outcomes.values().parallelStream().mapToDouble(Outcome::getValue).average().getAsDouble();

        // Iterate over entities to get aggregate stats for both attributes and events.
        int entity_index = 0;
        for (Entity _entity : _cohort.getEntities().values()) {
            // STEP A:
            // Update outcome vector.
            outcome_vector[entity_index] = cohort_outcomes.get(_entity.getID()).getValue();

            // STEP B:
            // Update aggregate stats for each attribute
            computeAggregateStatsForAttributes(_entity);

            // STEP C:
            // Update aggregate stats for each event type.
            // Begin by getting the event span for this entity.
            EventSpan _span = _cohort.getSpans().get(_entity.getID());
            List<Event> events_in_span = _entity.getEventList().subList(_span.getStart(), Math.min(_entity.getEventList().size(),_span.getEnd()));

            // Now iterate over the sublist, updating the stats for each one we encounter.
            Set<DataType> unique_types_and_parents = computeEventAndParentCountStats(events_in_span);

            // STEP D:
            // Now compute vectors for all of these events (both observed, and parent types in the hierarchy).
            for (DataType _type : unique_types_and_parents) {
                double[] _vector = type_vectors.computeIfAbsent(_type, (k) -> new double[size]);
                _vector[entity_index] = 1;
            }

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

        // And outcome binned by time after the query-defined event spans.
        computeOutcomesByTimeAfter(cohort_outcomes.values());

        return;
    }

    public Map<DataType,Integer> getEventsEntityCount() {
        return eventsEntityCount;
    }

    public Map<DataType,Integer> getEventsTotalCount() {
        return eventsTotalCount;
    }

    public Map<DataType, Map<Object, Integer>> getAttributes() {
        return attributes;
    }
}
