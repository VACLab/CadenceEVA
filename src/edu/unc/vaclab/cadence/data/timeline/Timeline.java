package edu.unc.vaclab.cadence.data.timeline;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.query.*;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.*;
import java.util.stream.Collectors;

public class Timeline implements JSONSerializable {

    private Milestone root;
    private Cohort cohort;
    private Map<Integer,Milestone> milestoneIndex;
    private Map<Integer,Pathway> pathwayIndex;


    public Timeline(Cohort _cohort) {
        cohort = _cohort;

        // Init the indices which will be used to look up timeline components by id.
        milestoneIndex = new HashMap<>();
        pathwayIndex = new HashMap<>();

        for (String _key : _cohort.getSpans().keySet()) {
            EventSpan _span = _cohort.getSpans().get(_key);
            int event_count = _cohort.getEntities().get(_key).getEventList().size();
            if ((_span.getStart() > event_count) || (_span.getEnd() > event_count)) {
                System.out.println("INVALID SPAN!");
                System.out.println("SPAN: " + _span.getStart() + " - " + _span.getEnd());
                System.out.println("Event count: " + event_count);
                System.out.flush();
            }
        }
        // Map the cohort's temporal constraints to an initial set of milestones.
        root = constructInitialMilestones(_cohort.getCohortConstraints().getTemporalConstraints(), _cohort.getEntities(), _cohort.getSpans());
        System.out.println("Done building initial timeline milestones.");
    }

    public Timeline(Cohort _cohort, Milestone root_to_clone) {
        cohort = _cohort;

        // Init the indices which will be used to look up timeline components by id.
        milestoneIndex = new HashMap<>();
        pathwayIndex = new HashMap<>();

        // Now clone recursively.
        root = cloneMilestonesRecursively(root_to_clone, new HashMap<>());
    }

    public Constraint toQueryConstraints() {
        // Is the root a virtual milestone?  If so, special case it.
        if (this.root instanceof VirtualMilestone) {
            // Start with what comes after the root.
            // Create a constraint for the first pathway destination.
            Constraint part_b = toQueryConstraintsHelper((this.root.getPathways().get(0).getDestination()));
            if (this.root.getPathways().get(0).getExclusionConstraints() != null) {
                ExclusionConstraint exclusion_constraint = new ExclusionConstraint(new ArrayList<>(this.root.getPathways().get(0).getExclusionConstraints()));
                part_b = new RelationConstraint(exclusion_constraint, RelationConstraint.RelationType.THEN, null, part_b);
            }

            // Or it with the remaining pathway destinations.
            for (int i=1; i<this.root.getPathways().size(); i++) {
                Pathway next_pathway = this.root.getPathways().get(i);
                Constraint next_constraint = toQueryConstraintsHelper((next_pathway.getDestination()));

                // Does the pathway have exclusion criteria?  If so, precede the next_constraint with an exclusion constraint.
                if (next_pathway.getExclusionConstraints() != null) {
                    ExclusionConstraint exclusion_constraint = new ExclusionConstraint(new ArrayList<>(next_pathway.getExclusionConstraints()));
                    next_constraint = new RelationConstraint(exclusion_constraint, RelationConstraint.RelationType.THEN, null, next_constraint);
                }

                part_b = new RelationConstraint(part_b, RelationConstraint.RelationType.OR, null, next_constraint);
            }

            // Finally, append a relation constraint to the front to represent the virtual milestone.
            return new RelationConstraint(null, RelationConstraint.RelationType.THEN_EQUAL, ((VirtualMilestone) this.root).getTimeConstraint(), part_b);
        }
        else {
            // If not, recurse from the root.
            return toQueryConstraintsHelper(this.root);
        }
    }

    private Constraint toQueryConstraintsHelper(Milestone _milestone) {
        // Create a constraint for the current milestone.
        Constraint _constraint = null;
        if (_milestone instanceof VirtualMilestone) {
            // This must be the end, since we handle the "start" virtual milestone in the main toQueryConstraints function.
            _constraint = new RelationConstraint(null, RelationConstraint.RelationType.THEN_EQUAL, ((VirtualMilestone) _milestone).getTimeConstraint(), null);
        }
        else if (_milestone instanceof ConstraintMilestone) {
            // Date constraint or event constraint.
            _constraint = ((ConstraintMilestone)_milestone).getConstraint().deepCopy();

            if (_milestone.getPathways().size() > 0) {
                Constraint part_b = toQueryConstraintsHelper((_milestone.getPathways().get(0).getDestination()));
                if (_milestone.getPathways().get(0).getExclusionConstraints() != null) {
                    ExclusionConstraint exclusion_constraint = new ExclusionConstraint(new ArrayList<>(_milestone.getPathways().get(0).getExclusionConstraints()));
                    part_b = new RelationConstraint(exclusion_constraint, RelationConstraint.RelationType.THEN, null, part_b);
                }

                for (int i=1; i<_milestone.getPathways().size(); i++) {
                    Pathway next_pathway = _milestone.getPathways().get(i);
                    Constraint next_constraint = toQueryConstraintsHelper((next_pathway.getDestination()));

                    // Does the pathway have exclusion criteria?  If so, precede the next_constraint with an exclusion constraint.
                    if (next_pathway.getExclusionConstraints() != null) {
                        ExclusionConstraint exclusion_constraint = new ExclusionConstraint(new ArrayList<>(next_pathway.getExclusionConstraints()));
                        next_constraint = new RelationConstraint(exclusion_constraint, RelationConstraint.RelationType.THEN, null, next_constraint);
                    }
                    part_b = new RelationConstraint(part_b, RelationConstraint.RelationType.OR, null, next_constraint);
                }

                // Now combine the milestone constraint with the "part_b" pathway constraints using a THEN operator.
                _constraint = new RelationConstraint(_constraint, RelationConstraint.RelationType.THEN, null, part_b);
            }
        }

        return _constraint;

    }

    private Milestone cloneMilestonesRecursively(Milestone milestone_to_clone, Map<Integer,Milestone> cloned_milestone_index) {
        // Clone to milestone.
        Milestone cloned_milestone = milestone_to_clone.clone(cohort.getEntities(), this);

        // If no entities remain after the clone, return a null value to indicate that the clone doesn't contain this milestone.
        if (cloned_milestone == null) {
            return null;
        }

        // If the function is still moving forward, then we need to index the new milestone and recurse through the list
        // of pathways that leave this milestone.
        this.milestoneIndex.put(cloned_milestone.id, cloned_milestone);

        // We also keep track of a map to connect the "old original before cloning ID" to the newly cloned milestone (which
        // has a different ID).  This is used to prevent cloning the same milestone twice when we traverse the pathways.
        cloned_milestone_index.put(milestone_to_clone.id, cloned_milestone);

        // Does the milestone that was cloned have pathways?  If so, clone each and (if not empty) recurse to the destination nodes.
        for (Pathway pathway_to_clone : milestone_to_clone.pathways) {
            // Has the destination for this pathway already been cloned?
            Milestone cloned_dest = cloned_milestone_index.get(pathway_to_clone.getDestination().id);
            if (cloned_dest == null) {
                // If not, clone it.
                cloned_dest = cloneMilestonesRecursively(pathway_to_clone.getDestination(), cloned_milestone_index);
            }

            if (cloned_dest != null) {
                Pathway cloned_pathway = pathway_to_clone.clone(cloned_milestone, cloned_dest, cohort.getEntities().keySet());
                // A null cloned pathway results when zero entities would exist in the clone.  If we find null as a return
                // result, we want to skip this pathway when cloning.
                if (cloned_pathway != null) {
                    cloned_milestone.pathways.add(cloned_pathway);
                    this.pathwayIndex.put(cloned_pathway.id, cloned_pathway);
                }
            }
        }

        // Return the milestone.
        return cloned_milestone;
    }

    public Cohort getCohort() {
        return cohort;
    }

    public Pathway getPathway(int pathway_id) {
        return pathwayIndex.get(pathway_id);
    }

    public Milestone getMilestone(int milestone_id) {
        return milestoneIndex.get(milestone_id);
    }

    private Milestone constructInitialMilestones(Constraint _constraint, Map<String, Entity> _entities, Map<String, EventSpan> _spans) {
        if ((_constraint instanceof DateConstraint) || (_constraint instanceof EventTypeConstraint)) {
            // Create a milestone and return.
            Map<String,EventSpan> milestone_spans = ConstraintMilestone.deriveSpans(_entities, _spans, _constraint);
            ConstraintMilestone new_milestone = new ConstraintMilestone(this, _constraint, new HashMap<>(_entities), milestone_spans);
            milestoneIndex.put(new_milestone.id, new_milestone);
            return new_milestone;
        }
        else if (_constraint instanceof RelationConstraint) {

            RelationConstraint _relation = (RelationConstraint)_constraint;

            // Recursively build the milestones and combine to express the relationship between the two parts.
            Milestone part_a;
            Milestone part_b;
            boolean part_a_is_virtual = false;

            if (_relation.getConstraintA() != null) {
                // For "part A" we can use the full span when we recurse..
                part_a = constructInitialMilestones(_relation.getConstraintA(), new HashMap<>(_entities), _spans);
            }
            else {
                // This should only happen at the very start of the timeline.
                Map<String,EventSpan> milestone_spans = VirtualMilestone.deriveSpans(_spans, VirtualMilestone.Type.START_OF_TIMELINE);
                part_a = new VirtualMilestone(this, _relation.getType(), _relation.getTimeConstraint(), new HashMap<>(_entities), milestone_spans, VirtualMilestone.Type.START_OF_TIMELINE);
                part_a_is_virtual = true;
                milestoneIndex.put(part_a.id, part_a);
            }

            Map<String,EventSpan> trimmed_spans = trimSpans(part_a.spans, _spans);

            if (_relation.getConstraintB() != null) {
                // For "part B", we need to use the trim to spans to ignore the portions of the events used in the "part A"
                // milestones. To do this, we can take the ends of Part A to use as the start for the new spans.
                part_b = constructInitialMilestones(_relation.getConstraintB(), _entities, trimmed_spans);

                // If part a was virtual, now that part_b has been constructed we can compute the entity timestamps for part a.
                if (part_a_is_virtual) {
                    ((VirtualMilestone) part_a).setVirtualTimestamps(part_b);
                }
            }
            else {
                // This should only happen at the very end of the timeline.
                Map<String,EventSpan> milestone_spans = VirtualMilestone.deriveSpans(_spans, VirtualMilestone.Type.END_OF_TIMELINE);
                part_b = new VirtualMilestone(this, _relation.getType(), _relation.getTimeConstraint(), new HashMap<>(_entities), milestone_spans, VirtualMilestone.Type.END_OF_TIMELINE);
                ((VirtualMilestone)part_b).setVirtualTimestamps(part_a);
                milestoneIndex.put(part_b.id, part_b);
            }

            // Now combine the parts.
            // For now, we only support "THEN*" relationships.
            // We do this by first finding the "end" of part a, then appending part B to it.
            Milestone end_of_part_a = Objects.requireNonNull(part_a, "Part A should never be null.");
            while (end_of_part_a.getPathways().size() > 0) {
                end_of_part_a = end_of_part_a.getPathways().get(0).getDestination();
            }

            Pathway new_pathway = new Pathway(end_of_part_a, part_b, part_b.getEntities().keySet(), null);
            pathwayIndex.put(new_pathway.id, new_pathway);
            end_of_part_a.getPathways().add(new_pathway);

            return part_a;
        }
        else {
            // THIS SHOULD NEVER HAPPEN!
            System.err.println("Invalid Constraint Type: Timeline:constructInitialMilestones(...)");
            return null;
        }
    }

    public boolean insertMilestone(String element_type, int element_id, DataType data_type) {

        if (element_type == "milestone") {
            System.err.println("MILESTONE SPLITTING IS NOT YET SUPPORTED.");
            return false;
        }
        else {
            insertMilestoneIntoPathway(pathwayIndex.get(element_id), data_type);
        }

        return true;
    }

    private void insertMilestoneIntoPathway(Pathway path_to_split, DataType split_data_type) {
        // This operation will create one new milestone and three new pathways, which together replace the previous pathway.
        Set<String> no_split_entities = new HashSet<>();
        HashMap<String,EventSpan> split_spans = new HashMap<>();
        HashMap<String,Entity> split_entities = new HashMap<>();

        // First, find the split point (if it exists) for each entity in the current pathway.
        Map<String,EventSpan> _spans = path_to_split.getSpans();

        for (String _id : _spans.keySet()) {
            // Get this id's events.
            Entity _entity = cohort.getEntities().get(_id);
            List<Event> entity_events = _entity.getEventList();

            // Look for the specified data type within this span.
            EventSpan orig_span = _spans.get(_id);
            int i = orig_span.getStart();
            boolean _found = false;

            while (!_found && i<orig_span.getEnd()) {
                DataType event_type = entity_events.get(i).getType();
                if (event_type.isEqualToOrChildOf(split_data_type)) {
                    _found = true;
                }
                else {
                    i++;
                }
            }

            // If the event has not been found, add this entity to a new path for "no event" entities.
            if (!_found) {
                no_split_entities.add(_id);
            }
            // If the event has been found, there is more work to do.
            else {
                // Find the span for the matching period of time.  This should include the matching event, plus any
                // events before and after that have the same timestamp.
                int _start = i;
                int _end = i+1;
                long matching_time = entity_events.get(i).getTimestamp();

                // Grow the span backwards in time.
                boolean _done = false;
                while (!_done && (_start > orig_span.getStart())) {
                    if (matching_time == entity_events.get(_start-1).getTimestamp()) {
                        _start--;
                    }
                    else {
                        _done = true;
                    }
                }

                // Now grow the span forwards.
                _done = false;
                while (!_done && (_end < orig_span.getEnd())) {
                    if (matching_time == entity_events.get(_end).getTimestamp()) {
                        _end++;
                    }
                    else {
                        _done = true;
                    }
                }

                EventSpan new_milestone_span = new EventSpan(_start, _end, false);
                split_spans.put(_id, new_milestone_span);
                split_entities.put(_id, _entity);
            }
        }

        // We've now looked at every entity and identified the split points.  Time to update the timeline graph by
        // replacing the current pathway with a triple-pathway-and-new-milestone structure:
        //
        // SRC==============DEST   becomes       SRC========NEW========DEST
        //                                          `================='

        // Step 1: Get the index of the old pathway (allowing us to put the new pathways in the same place in the list of outgoing pathways.
        int path_index = path_to_split.getSource().getPathways().indexOf(path_to_split);
        path_to_split.getSource().getPathways().remove(path_to_split);
        this.pathwayIndex.remove(path_to_split.id);

        // Step 2: Create new milestone.
        Milestone new_milestone = new ConstraintMilestone(this, new EventTypeConstraint(split_data_type), split_entities, split_spans);
        this.milestoneIndex.put(new_milestone.id, new_milestone);

        // Step 3: Create 3 new pathways and link to the correct milestones.
        Pathway before_path = new Pathway(path_to_split.getSource(), new_milestone, split_entities.keySet(), path_to_split.getExclusionConstraints());
        before_path.getSource().getPathways().add(path_index, before_path);
        this.pathwayIndex.put(before_path.id, before_path);

        Pathway after_path = new Pathway(new_milestone, path_to_split.getDestination(), split_entities.keySet(), path_to_split.getExclusionConstraints());
        after_path.getSource().getPathways().add(after_path);
        this.pathwayIndex.put(after_path.id, after_path);

        // Update the exclusion constraint list for the "no split path"
        List<Constraint> expanded_exclusion_constraints;
        if (path_to_split.getExclusionConstraints() != null) {
            expanded_exclusion_constraints = new ArrayList<>(path_to_split.getExclusionConstraints());
        }
        else {
            expanded_exclusion_constraints = new ArrayList<>();
        }
        expanded_exclusion_constraints.add(new EventTypeConstraint(split_data_type));
        Pathway no_split_path = new Pathway(path_to_split.getSource(), path_to_split.getDestination(), no_split_entities, expanded_exclusion_constraints);
        no_split_path.getSource().getPathways().add(path_index +1, no_split_path);
        this.pathwayIndex.put(no_split_path.id, no_split_path);

        // Step 4. Remove the index entry for the old path to let us forget it (and let it be garbage collected).
        this.pathwayIndex.remove(path_to_split.id);
    }

    public Timeline clone(Cohort _cohort) {
        // Create a new timeline with the private constructor which defers initial milestone construction.
        Timeline cloned_timeline = new Timeline(_cohort, this.root);

        return cloned_timeline;
    }

    private Map<String,EventSpan> trimSpans(Map<String,EventSpan> prefix_spans, Map<String,EventSpan> full_spans) {
        return full_spans.entrySet().stream().collect(Collectors.toMap(
                _entry -> _entry.getKey(),
                _entry -> {
                    EventSpan orig_span = _entry.getValue();
                    return new EventSpan(prefix_spans.get(_entry.getKey()).getEnd(),orig_span.getEnd(), orig_span.isSoftSpan());
                }
        ));
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();
        if (root != null) {
            _json.put("root", root.id);
            _json.put("milestones", milestonesToJSON());
            _json.put("paths", pathsToJSON());
        }
        return _json;
    }

    private JSONObject milestonesToJSON() throws JSONException {
        JSONObject milestone_json = new JSONObject();
        for (Milestone _milestone : this.milestoneIndex.values()) {
            milestone_json.put(String.valueOf(_milestone.id), _milestone.toJSON());
        }
        return milestone_json;
    }

    private JSONObject pathsToJSON() throws JSONException {
        JSONObject pathway_json = new JSONObject();
        for (Pathway _pathway : this.pathwayIndex.values()) {
            pathway_json.put(String.valueOf(_pathway.id), _pathway.toJSON());
        }
        return pathway_json;
    }
}
