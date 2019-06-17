package edu.unc.vaclab.cadence.data.distance;

import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.*;

/**
 * Created by borland on 8/13/18.
 */

public class DistanceMap implements JSONSerializable {
    private Map<Integer, Cohort> cohorts;
    private Cohort root;
    private Map<Integer,Map<Integer,CohortDistance>> distanceMap;

    public DistanceMap(Cohort _root, Map<Integer,Cohort> _cohorts) {
        cohorts = _cohorts;
        root = _root;

        distanceMap = new HashMap<>();

        // Add any cohorts already in the cohort map (should typically be just the root)
        for (Cohort cohort : cohorts.values()) {
            addCohort(cohort);
        }
    }

    public void addCohort(Cohort cohort) {
        int id = cohort.getID();

        // Add a map for this cohort
        distanceMap.put(id, new HashMap<>());

        // Loop over all cohorts and compute distance to the new cohort
        for (Cohort cohort2 : cohorts.values()) {
            int id2 = cohort2.getID();

            CohortDistance distance = new CohortDistance(cohort, cohort2, root);

            distanceMap.get(id).put(id2, distance);
            distanceMap.get(id2).put(id, distance);
        }
    }

    public void removeCohort(Cohort cohort) {
        // TODO: Implement cohort removal
    }

    public CohortDistance getDistance(int cohort1, int cohort2) {
        return distanceMap.get(cohort1).get(cohort2);
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        for (Map.Entry<Integer,Map<Integer,CohortDistance>> map1 : distanceMap.entrySet()) {
            JSONObject _jsonObject = new JSONObject();

            for (Map.Entry<Integer,CohortDistance> map2 : map1.getValue().entrySet()) {
                _jsonObject.put(String.valueOf(map2.getKey()), map2.getValue().getAverage());
            }

            _json.put(String.valueOf(map1.getKey()), _jsonObject);
        }

        return _json;
    }
}
