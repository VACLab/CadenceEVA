package edu.unc.vaclab.cadence.data.timeline;

import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.data.stats.MilestoneStats;
import edu.unc.vaclab.cadence.data.stats.TimelineStats;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Represents a milestone in the timeline for a cohort.  There
 * are two subtypes: a constraint milestone (corresponding to
 * a specific event), and a virtual milestone (corresponding to
 * a time window boundary).
 */
public abstract class Milestone implements JSONSerializable {

    protected int id;
    protected Timeline timeline;
    protected Map<String,Entity> entities;
    protected Map<String, EventSpan> spans;
    protected ArrayList<Pathway> pathways;
    protected TimelineStats stats;

    private static int NEXT_ID = 0;
    private synchronized static int generateID() {
        return NEXT_ID++;
    }

    public Milestone(Timeline _timeline, Map<String,Entity> _entities, Map<String,EventSpan> _spans) {
        id = generateID();
        timeline = _timeline;
        entities = _entities;
        spans = _spans;
        pathways = new ArrayList<>();

        stats = new MilestoneStats(_timeline, this, _spans);
        stats.computeStats();
    }

    public Map<String,Entity> getEntities() {
        return entities;
    }

    public Map<String,EventSpan> getSpans() {
        return spans;
    }

    public Timeline getTimeline() {
        return timeline;
    }

    public List<Pathway> getPathways() {
        return pathways;
    }

    public TimelineStats getStats() {
        return stats;
    }

    public void removePathway(Pathway _path) {
        pathways.remove(_path);
    }

    public abstract Milestone clone(Map<String,Entity> entities_to_include_in_clone, Timeline cloned_timeline);

    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        _json.put("id", id);
        JSONArray _pathways = new JSONArray();
        for (Pathway _path : pathways) {
            _pathways.add(_path.id);
        }
        _json.put("pathways", _pathways);
        _json.put("stats", stats.toJSON());

        return _json;
    }
}

