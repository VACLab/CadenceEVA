package edu.unc.vaclab.cadence.data.distance;

import edu.unc.vaclab.cadence.data.AttributedDataType;
import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.DataType;
import edu.unc.vaclab.cadence.data.stats.CohortStats;
import edu.unc.vaclab.cadence.data.JSONSerializable;
import edu.unc.vaclab.cadence.query.*;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;
import org.apache.commons.math3.stat.StatUtils;

import javax.xml.crypto.Data;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Created by borland on 9/13/18.
 */

public class CohortDistance implements JSONSerializable {

    // Average distance
    private double average = 0.0;

    // Distance for attributes and events
    private Map<DataType, Double> attributes;
    private Map<DataType, Double> events;

    // Intersection between cohorts
    private Set<String> intersection;

    public CohortDistance(Cohort cohort1, Cohort cohort2, Cohort root) {
        attributes = new HashMap<>();
        events = new HashMap<>();

        computeDistance(cohort1, cohort2, root);
    }

    public double getAverage() { return average; }

    private void computeDistance(Cohort cohort1, Cohort cohort2, Cohort root) {
        if (cohort1 == cohort2) return;

        int n1 = cohort1.getEntities().size();
        int n2 = cohort2.getEntities().size();

        // Compute intersection
        intersection = new HashSet<>(cohort1.getEntities().keySet());
        intersection.retainAll(cohort2.getEntities().keySet());

        // Get all attribute types in the root
        Set<AttributedDataType> attributeTypes = root.getStats().getAttributes().keySet().stream().map(k -> (AttributedDataType)k).collect(Collectors.toSet());

        // Get all event types in the root
        Set<DataType> eventTypes = root.getStats().getEventsEntityCount().keySet();

        // Create array to hold distances
        double[] distances = new double[attributeTypes.size() + eventTypes.size()];
        int i = 0;

        // Get attribute constraint types
        Set<DataType> attributeConstraintTypes = cohort1.getCohortConstraints().getSetOfAttributeConstraintDataTypes();
        Set<DataType> attributeConstraintTypes2 = cohort2.getCohortConstraints().getSetOfAttributeConstraintDataTypes();

        // Take the union
        attributeConstraintTypes.addAll(attributeConstraintTypes2);

        // Get event constraint types
        Set<DataType> eventConstraintTypes = cohort1.getCohortConstraints().getSetOfEventConstraintDataTypes();
        Set<DataType> eventConstraintTypes2 = cohort2.getCohortConstraints().getSetOfEventConstraintDataTypes();

        // Take the union
        eventConstraintTypes.addAll(eventConstraintTypes2);

        // Attribute distances
        for (AttributedDataType type : attributeTypes) {
            double d = 0.0;

            if (n1 > 0 && n2 > 0) {
                double[] p;
                double[] q;

                if (type.getValueType().equals("int")) {
                    // Get the range from the root
                    // TODO: A bit wasteful to compute this every time
                    Set<Integer> keys = root.getStats().getAttributes().get(type).keySet().stream().map(k -> (Integer) k).collect(Collectors.toSet());
                    int min = Collections.min(keys);
                    int max = Collections.max(keys);

                    p = integersToProbabilityDistribution(cohort1, type, min, max);
                    q = integersToProbabilityDistribution(cohort2, type, min, max);
                } else {
                    p = categoricalToProbabilityDistribution(cohort1, type);
                    q = categoricalToProbabilityDistribution(cohort2, type);
                }

                d = hellingerDistance(p, q);
            }

            attributes.put(type, d);

            // Only include in average if not a constraint
            if (!attributeConstraintTypes.contains(type)) {
                distances[i] = d;
                i++;
            }
        }

        // Event type distances
        for (DataType type : eventTypes) {
            double d = 0.0;

            if (n1 > 0 && n2 > 0) {
                double[] p = eventCountToProbabilityDistribution(cohort1, type);
                double[] q = eventCountToProbabilityDistribution(cohort2, type);

                d = hellingerDistance(p, q);
            }

            events.put(type, d);



            // Only include in average if not a constraint, or child of a constraint
            boolean constrained = false;
            for (DataType constraint : eventConstraintTypes) {
                if (type.isEqualToOrChildOf(constraint)) {
                    constrained = true;
                    break;
                }
            }
            
            if (!constrained) {
                distances[i] = d;
                i++;
            }
        }

        average = StatUtils.mean(distances);
    }

    private double[] integersToProbabilityDistribution(Cohort cohort, AttributedDataType type, int min, int max) {
        double n = cohort.getEntities().size();

        Map<DataType, Map<Object, Integer>> attributes = cohort.getStats().getAttributes();

        double[] pd = new double[max - min + 1];

        if (!attributes.containsKey(type)) {
            // Should not get here, but just in case
            System.out.println("Missing attribute: " + type.getCode());

            return pd;
        }

        Map<Object, Integer> attribute = attributes.get(type);

        // Get the counts and convert to a probability for each value in the range
        int i = 0;
        double total = 0.0;
        for (int j = min; j <= max; j++) {
            pd[i] = attribute.containsKey(j) ? attribute.get(j) / n : 0.0;

            total += pd[i];

            i++;
        }

        // Sanity check
        if (Math.abs(total - 1.0) > 0.01) {
            System.out.println("PROBLEM: Total probability not equal to 1.0");
            System.out.println(total);
            System.out.println(attribute);
        }

        return pd;
    }

    private double[] categoricalToProbabilityDistribution(Cohort cohort, AttributedDataType type) {
        double n = cohort.getEntities().size();

        Map<DataType, Map<Object, Integer>> attributes = cohort.getStats().getAttributes();

        double [] pd = new double[type.getValueDomain().size()];

        if (!attributes.containsKey(type)) {
            // Should not get here, but just in case
            System.out.println("Missing attribute: " + type.getCode());

            return pd;
        }

        Map<Object, Integer> attribute = attributes.get(type);

        // Get the counts and convert to a probability for each attribute value.
        // Assuming here that we are guaranteed a consistent value order.
        int i = 0;
        double total = 0.0;
        for (Object o : type.getValueDomain()) {
            pd[i] = attribute.containsKey(o) ? attribute.get(o) / n : 0.0;

            total += pd[i];

            i++;
        }

        // Sanity check
        if (Math.abs(total - 1.0) > 0.01) {
            System.out.println("PROBLEM: Total probability not equal to 1.0");
            System.out.println(total);
            System.out.println(attribute);
        }

        return pd;
    }

    private double[] eventCountToProbabilityDistribution(Cohort cohort, DataType type) {
        double n = cohort.getEntities().size();

        Map<DataType, Integer> counts = cohort.getStats().getEventsEntityCount();

        int count = counts.containsKey(type) ? counts.get(type) : 0;
        double v = count / n;

        double[] pd = new double[2];
        pd[0] = v;
        pd[1] = 1.0 - v;

        return pd;
    }

    private Double hellingerDistance(double[] p, double[] q) {
        int k = p.length;

        double sum = 0.0;

        for (int i = 0; i < k; i++) {
            sum += Math.pow(Math.sqrt(p[i]) - Math.sqrt(q[i]), 2);
        }

        return Math.sqrt(sum / 2);
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        _json.put("average", average);
        _json.put("attributes", attributesToJSON());
        _json.put("events", eventsToJSON());
        // TODO: Just send the number for now, could send the ids if needed
        _json.put("intersection", intersection.size());

        return _json;
    }

    protected JSONObject attributesToJSON() throws JSONException {
        JSONObject json = new JSONObject();

        // Add each attribute
        for (DataType type : attributes.keySet()) {
            JSONObject attribute = type.toJSON();

            attribute.put("distance", attributes.get(type));

            json.put(type.getCode(), attribute);
        }

        return json;
    }

    protected JSONObject eventsToJSON() throws JSONException {
        JSONObject json = new JSONObject();

        // Add each event
        for (DataType type : events.keySet()) {
            JSONObject event = type.toJSON();

            event.put("id", type.getID());

            // If this data type has a parent, include its id.
            if (type.getParent() != null) {
                event.put("parent_id", type.getParent().getID());
            }

            event.put("cat", type.getCategory());
            event.put("code", type.getCode());
            event.put("label", type.getLabel());
            event.put("distance", events.get(type));

            json.put(Integer.toString(type.getID()), event);
        }

        return json;
    }
}
