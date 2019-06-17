package edu.unc.vaclab.cadence.data.timeline;

import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.data.stats.PathwayStats;
import edu.unc.vaclab.cadence.data.stats.TimelineStats;
import edu.unc.vaclab.cadence.query.Constraint;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.*;

public class Pathway implements JSONSerializable {

    private Milestone source;
    private Milestone destination;
    private TimelineStats stats;
    private List<Constraint> exclusionConstraints;
    private Map<String, EventSpan> spans;
    protected int id;

    private static int NEXT_ID = 0;
    private synchronized static int generateID() {
        return NEXT_ID++;
    }

    public Pathway(Milestone _src, Milestone _dest, Set<String> entity_ids, List<Constraint> exclusion_constraints) {
        id = generateID();
        source = _src;
        destination = _dest;
        exclusionConstraints = exclusion_constraints;

        // Spans are derived from the src and dest milestones.
        Map<String, EventSpan> src_spans = _src.getSpans();
        Map<String, EventSpan> dest_spans = _dest.getSpans();

        spans = new HashMap<>();
        for (String _id : entity_ids) {
            spans.put(_id, new EventSpan(src_spans.get(_id).getEnd(),dest_spans.get(_id).getStart(),false));
        }

        // Calculate stats.
        stats = new PathwayStats(_src.getTimeline(), this, spans);
        stats.computeStats();
    }

    public List<Constraint> getExclusionConstraints() {
        return exclusionConstraints;
    }

    protected Pathway clone(Milestone _src, Milestone _dest, Set<String> entities_to_include_in_clone) {
        Set<String> intersection_entity_set = new HashSet<>(this.spans.keySet());
        intersection_entity_set.retainAll(entities_to_include_in_clone);

        // If the clone would result in an empty pathway, return null.
        if (intersection_entity_set.size() == 0) {
            return null;
        }

        // Given that more than zero entities remain in the pathway, create the clone and return.
        Pathway cloned_pathway = new Pathway(_src, _dest, intersection_entity_set, exclusionConstraints);
        return cloned_pathway;
    }

    public Milestone getDestination() {
        return destination;
    }

    public Milestone getSource() {
        return source;
    }

    public Map<String,EventSpan> getSpans() {
        return spans;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _pathway = new JSONObject();

        _pathway.put("id", id);
        _pathway.put("stats", stats.toJSON());
        _pathway.put("dest", destination.id);
        if ((exclusionConstraints != null) && (exclusionConstraints.size() > 0)) {
            _pathway.put("exclusion", exclusionConstraintsToJSON());
        }

        return _pathway;
    }

    private JSONArray exclusionConstraintsToJSON() throws JSONException {
        JSONArray _json = new JSONArray();

        for (Constraint _constraint : exclusionConstraints) {
            _json.add(_constraint.toJSON());
        }
        return _json;
    }
}

