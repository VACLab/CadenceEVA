package edu.unc.vaclab.cadence.data.timeline;

import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.Event;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.query.Constraint;
import edu.unc.vaclab.cadence.query.DateConstraint;
import edu.unc.vaclab.cadence.query.EventTypeConstraint;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class ConstraintMilestone extends Milestone implements JSONSerializable {
    private Constraint constraint;

    public static Map<String, EventSpan> deriveSpans(Map<String,Entity> _entities, Map<String, EventSpan> _spans, Constraint _constraint) {
        // Behavior depends on the type of constraint.
        if (_constraint instanceof DateConstraint) {
            DateConstraint date_constraint = (DateConstraint)_constraint;

            // Define a spans to reflect the specified date.
            return _spans.entrySet().stream().collect(Collectors.toMap(
                    _entry -> _entry.getKey(),
                    _entry -> {
                        EventSpan orig_span = _entry.getValue();
                        List<Event> entity_events = _entities.get(_entry.getKey()).getEventList();

                        // Find the first event on or after the constraint date.
                        int _index = orig_span.getStart();
                        while (entity_events.get(_index).before(date_constraint.getDateValue().getTime()) && (_index < orig_span.getEnd())) {
                            // Increment to check the next event.
                            _index++;
                        }

                        // We've reached the first event NOT BEFORE the constraint, or the end of the span.  We mark this
                        // the start of the span for this milestone.
                        int span_start = _index;

                        // Now continue to grow the span until we reach the first event AFTER the constraint.  This will
                        // have the span account for events on the same date as the date constraint.
                        while ((!entity_events.get(_index).after(date_constraint.getDateValue().getTime())) && (_index < orig_span.getEnd())) {
                            // Increment to check the next event.
                            _index++;
                        }

                        // If there are no events with the same time as the constraint, we consider this a soft span.
                        boolean soft_span = (span_start == _index);
                        return new EventSpan(span_start, _index, soft_span);
                    }
            ));
        }
        // If not a date, this must be an event type constraint.
        else {
            EventTypeConstraint event_constraint = (EventTypeConstraint)_constraint;

            // Define spans to reflect the specified event type.
            return _spans.entrySet().stream().collect(Collectors.toMap(
                    _entry -> _entry.getKey(),
                    _entry -> {
                        EventSpan orig_span = _entry.getValue();
                        List<Event> entity_events = _entities.get(_entry.getKey()).getEventList();

                        // Find the first event that matches the constraint event type.
                        // But only if we aren't already at the end.
                        int _index = orig_span.getStart();
                        if (_index < entity_events.size()) {
                            while (!entity_events.get(_index).getType().isEqualToOrChildOf(event_constraint.getDataType()) && (_index < orig_span.getEnd())) {
                                // Increment to check the next event.
                                _index++;
                            }
                        }

                        // We've reached the first event to match the event type, or the end of the span.  If not at the
                        // end (which means we had no match) we should expand the span to account for all neighboring
                        // events with the same timestamp.
                        if (_index < orig_span.getEnd()) {
                            int span_start = _index;
                            int span_end = _index+1;

                            // Get the time of the matching event.
                            long matching_time = entity_events.get(_index).getTimestamp();

                            // Now grow span_start toward the start of the span as long as the times are equivalent.
                            while ((span_start > 1) && (entity_events.get(span_start-1).getTimestamp() == matching_time)) {
                                span_start--;
                            }

                            // Now grow span_end toward the end of the span as long as the times are equivalent.
                            while ((span_end < entity_events.size()) && (span_end < orig_span.getEnd()) && (entity_events.get(span_end).getTimestamp() == matching_time)) {
                                span_end++;
                            }

                            // Finally, return the span.
                            return new EventSpan(span_start, span_end, false);
                        }
                        else {
                            // We didn't find a match.  Return a span that reflects this.
                            return new EventSpan(_index, _index, true);
                        }
                    }
            ));
        }
    }

    public ConstraintMilestone(Timeline _timeline, Constraint _type, Map<String, Entity> _entities, Map<String, EventSpan> _spans) {
        super(_timeline, _entities, _spans);
        this.constraint = _type;
    }

    public Constraint getConstraint() {
        return constraint;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _milestone = super.toJSON();

        _milestone.put("constraint", constraint.toJSON());

        return _milestone;
    }

    @Override
    public Milestone clone(Map<String,Entity> entities_to_include_in_clone, Timeline cloned_timeline) {

        Map<String, Entity> entities_for_clone = new HashMap<>(this.entities);
        entities_for_clone.keySet().retainAll(entities_to_include_in_clone.keySet());

        // Are there entities that remain after the set intersection? If not, return null and
        // stop the cloning process.
        if (entities_for_clone.size() == 0) {
            return null;
        }

        Map<String, EventSpan> spans_for_clone = new HashMap<>(this.spans);
        spans_for_clone.keySet().retainAll(entities_to_include_in_clone.keySet());

        return new ConstraintMilestone(cloned_timeline, this.constraint.deepCopy(), entities_for_clone, spans_for_clone);
    }
}
