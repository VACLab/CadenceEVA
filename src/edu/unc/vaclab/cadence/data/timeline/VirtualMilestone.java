package edu.unc.vaclab.cadence.data.timeline;

import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.query.RelationConstraint;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * This class represents a milestone that represents the start or end of a
 * time window rather than a specific event.
 */
public class VirtualMilestone extends Milestone implements JSONSerializable {

    public enum Type {
        START_OF_TIMELINE, END_OF_TIMELINE
    }

    protected static Map<String, EventSpan> deriveSpans(Map<String, EventSpan> _spans, Type milestone_type) {
        if (milestone_type == Type.START_OF_TIMELINE) {
            // If this virtual milestone is the very start, it is a soft span that specifies the very first event in the sequence
            // that comes after the start of the timeline.
            return _spans.entrySet().stream().collect(Collectors.toMap(
                    _entry -> _entry.getKey(),
                    _entry -> {
                        EventSpan orig_span = _entry.getValue();
                        return new EventSpan(orig_span.getStart(), orig_span.getStart(), true);
                    }

            ));
        }
        else if (milestone_type == Type.END_OF_TIMELINE) {
            // If this virtual milestone is the very end of the timeline, we specify the first index after the end. We
            // mark it as NOT a soft span since the event at the index of the span should not be considered to be part
            // of the timeline.
            return _spans.entrySet().stream().collect(Collectors.toMap(
                    _entry -> _entry.getKey(),
                    _entry -> {
                        EventSpan orig_span = _entry.getValue();
                        return new EventSpan(orig_span.getEnd(), orig_span.getEnd(), false);
                    }

            ));
        }
        else {
            // This should never happen.  It means the logic above does not correctly handle all virtual milestone
            // Types.  However, Java requires a return value and I'd like to explicitly check for the milestone types
            // rather than have an else.  This will help catch errors in the future in case we add new types of
            // virtual milestones.
            return null;
        }
    }

    protected RelationConstraint.RelationType relationship;
    protected Duration timeConstraint;
    protected Type type;
    protected Map<String,Long> virtualTimestamps;

    public VirtualMilestone(Timeline _timeline, RelationConstraint.RelationType _relationship, Duration time_constraint,
                            Map<String, Entity> _entities, Map<String, EventSpan> _spans, Type milestone_type) {

        super(_timeline, _entities, _spans);

        this.relationship = _relationship;
        this.timeConstraint = time_constraint;
        this.type = milestone_type;

        virtualTimestamps = null;
    }

    /**
     *
     * @param _milestone The milestone before the virtual milestone, unless the virtual milestone comes at the very start.
     *                   In this case, the virtual milestone given as a parameter should be the milestone after the start.
     */
    public void setVirtualTimestamps(Milestone _milestone) {
        // The virtual milestone must have time stamps relative to a neighboring milestone.  This must be calculated
        // on a per entity basis.
        virtualTimestamps = new HashMap<>();

        // For each entity, get the time associated with the prior milestone and compute the time for this milestone.
        for (Entity _entity : _milestone.getEntities().values()) {

            if (this.type == Type.START_OF_TIMELINE) {
                // Get the "start" time from the previous milestone, then subtract the duration of this milestone.
                int start_index = _milestone.getSpans().get(_entity.getID()).getStart();
                long virtual_time =_entity.getEventList().get(start_index).getTimestamp() - this.timeConstraint.toMillis();
                this.virtualTimestamps.put(_entity.getID(), virtual_time);
            }
            else {
                // Get the "end" time from the previous milestone, then add the duration of this milestone.
                int end_index = _milestone.getSpans().get(_entity.getID()).getEnd()-1;
                long virtual_time =_entity.getEventList().get(end_index).getTimestamp() + this.timeConstraint.toMillis();
                this.virtualTimestamps.put(_entity.getID(), virtual_time);
            }
        }
    }

    public Map<String,Long> getVirtualTimestamps() {
        return this.virtualTimestamps;
    }

    public Duration getTimeConstraint() {
        return timeConstraint;
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

        VirtualMilestone cloned_milestone = new VirtualMilestone(cloned_timeline, this.relationship, this.timeConstraint, entities_for_clone,
                spans_for_clone, this.type);

        // Copy data for the cloned milestone's virtual timestamps
        cloned_milestone.virtualTimestamps = new HashMap<>(this.virtualTimestamps);
        cloned_milestone.virtualTimestamps.keySet().retainAll(entities_to_include_in_clone.keySet());

        return cloned_milestone;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _milestone = super.toJSON();

        _milestone.put("relation", relationship.toString());
        _milestone.put("duration", timeConstraint.toDays());
        _milestone.put("type", type.toString());

        return _milestone;
    }
}

