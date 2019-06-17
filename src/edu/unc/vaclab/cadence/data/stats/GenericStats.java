package edu.unc.vaclab.cadence.data.stats;

import edu.unc.vaclab.cadence.data.*;
import org.apache.commons.json.JSONArray;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;
import org.apache.commons.math3.stat.correlation.PearsonsCorrelation;
import org.apache.commons.math3.distribution.ChiSquaredDistribution;

import java.util.*;
import java.util.stream.Collectors;

public abstract class GenericStats implements JSONSerializable {

    protected int size;
    protected float avgOutcome;
    protected SortedMap<Long, Integer> outcomesByTimeAfter;
    protected Map<DataType, Map<Object, Integer>> attributes;
    protected Map<DataType, Integer> eventsTotalCount;
    protected Map<DataType, Integer> eventsEntityCount;
    protected Map<DataType, Double> eventsCorrelation;
    protected Map<DataType, Double> eventsEntropy;
    protected Map<DataType, Set<DataType>> eventsChildren;
    protected PearsonsCorrelation correlationEngine;
    protected Set<DataType> rootDataTypes;
    protected Set<DataType> mostInformativeDataTypes;
    protected Map<DataType, Double> yatesMeasure;
    protected Map<DataType, Double> pValue;
    protected ChiSquaredDistribution chiSquareEngine;
    protected Map<DataType, Boolean> isRoot;
    protected Map<DataType, Double> scentRank;
    protected Map<DataType, Map<DataType, Double>> similarDataTypes;
    protected Map<DataType, Integer> leafFrequency;
    protected Map<DataType, Integer> informativeFrequency;

    protected JSONObject jsonData;

    public GenericStats() {
        initBlankStats();
    }

    protected void initBlankStats() {
        size = 0;
        avgOutcome = 0;
        outcomesByTimeAfter= new TreeMap<>();
        attributes = new HashMap<>();
        eventsTotalCount = new HashMap<>();
        eventsEntityCount = new HashMap<>();
        eventsCorrelation = new HashMap<>();
        eventsEntropy = new HashMap<>();
        eventsChildren = new HashMap<>();
        correlationEngine = new PearsonsCorrelation();
        rootDataTypes = new HashSet<>();
        mostInformativeDataTypes = new HashSet<>();
        yatesMeasure = new HashMap<>();
        pValue = new HashMap<>();
        chiSquareEngine = new ChiSquaredDistribution(1);
        isRoot = new HashMap<>();
        scentRank = new HashMap<>();
        similarDataTypes = new HashMap<>();
        leafFrequency = new HashMap<>();
        informativeFrequency = new HashMap<>();
        jsonData = null;
    }

    protected void computeAggregateStatsForAttributes(Entity _entity) {

        for (AttributedDataType attrib_type : _entity.getAttributes().keySet()) {

            // Get this entity's value for the attribute.
            Object attr_val = _entity.getAttributes().get(attrib_type);

            // Now to update the aggregate values for this data type.
            // First, get the entry for this attribute type, or create one if needed.
            if (!attributes.containsKey(attrib_type)) {
                attributes.put(attrib_type, new TreeMap<>());
            }
            Map<Object, Integer> attrib_map = attributes.get(attrib_type);

            // Next, check to see if there is already a count of this value of the attribute.
            if (attrib_map.containsKey(attr_val)) {
                // There is... we need to increment by one.
                attrib_map.put(attr_val, attrib_map.get(attr_val) + 1);
            } else {
                // There is not... we need to initialize with a count of one.
                attrib_map.put(attr_val, 1);
            }
        }

    }

    protected void computeOutcomesByTimeAfter(Collection<Outcome> outcome_collection) {
        for (Outcome _out : outcome_collection) {
            if (_out.getTimeToOutcome() != null) {
                // We have a time, so map it to days (instead of millis) and add it to the map.
                long _days = _out.getTimeToOutcome() / (1000*60*60*24);
                int current_value = outcomesByTimeAfter.computeIfAbsent(_days, k -> 0);
                outcomesByTimeAfter.put(_days, current_value+1);
            }
        }
    }

    protected void computeCorrelations(Map<DataType, double[]> type_vectors, double[] outcome_vector) {
        for (DataType _type : type_vectors.keySet()) {
            double _corr = (outcome_vector.length > 1 ? correlationEngine.correlation(outcome_vector, type_vectors.get(_type)) : 0);
            //eventsCorrelation.put(_type, _corr);

            if(!Double.isNaN(_corr)){
                eventsCorrelation.put(_type, _corr);
            }else{
                eventsCorrelation.put(_type, 0.0);
            }

            // While calculating the correlation for all event types, we also want to capture the subset
            // of the event hierarchy that is represented in this cohort. To do this, we have to make sure
            // that this event type is listed as a child of its parent.
            if (_type.getParent() != null) {
                Set<DataType> child_types = eventsChildren.computeIfAbsent(_type.getParent(), (k) -> new HashSet<DataType>());
                child_types.add(_type);
            }
            else {
                // The parent is null, so this must be a root type.
                rootDataTypes.add(_type);
            }
        }
    }

    protected Set<DataType> computeEventAndParentCountStats(List<Event> events_in_span) {
        Set<DataType> unique_types = new HashSet<>();

        for (Event _event : events_in_span) {
            DataType _type = _event.getType();

            // Update the event type counters, iteratively going up the parent chain to account for the type hierarchy.
            while (_type != null) {
                eventsTotalCount.put(_type, eventsTotalCount.getOrDefault(_type, 0) + 1);

                if (!unique_types.contains(_type)) {
                    unique_types.add(_type);
                    eventsEntityCount.put(_type, eventsEntityCount.getOrDefault(_type, 0) + 1);
                }

                _type = _type.getParent();
            }
        }

        return unique_types;
    }

    // Finds the informative data types
    protected void identifyInformativeTypes(Map<DataType, double[]> type_vectors, double[] outcome_vector) {
        // Traverse the tree of data types beneath each root type and calculate the chi-square value, root is set to 0.0
        computeAllChiSquare(type_vectors, outcome_vector);
        for (DataType _root : rootDataTypes) {
            this.yatesMeasure.put(_root, 0.0);
            //for(DataType _child : this.eventsChildren.get(_root)){
            //    traverseTree(_child, type_vectors, outcome_vector);
            //}
        }
        // Selects the most informative data types after mapping a chi square value to each node
        //findMostInformative();
        for (DataType _root : rootDataTypes) {
            this.isRoot.put(_root, true);
            findMostInformative2(_root, type_vectors, outcome_vector);
            computeLeafFrequency(_root);
        }
        //System.out.println(informativeFrequency.size() + "," + leafFrequency.size());
;   }

    // Computes the Chi-square value on all nodes
    private void computeAllChiSquare(Map<DataType, double[]> type_vectors, double[] outcome_vector){
        for (DataType _type : type_vectors.keySet()) {
            double measure = computeChiSquare(type_vectors.get(_type),outcome_vector);
            this.yatesMeasure.put(_type, measure);
            this.pValue.put(_type, 1-chiSquareEngine.cumulativeProbability(measure));

        }
    }

    /*
    // One idea for identifying informative types
    // Find the top n nodes with the highest chi square value
    private void findMostInformative(){
        Comparator<Map.Entry> bySPMeasure =
                (Map.Entry o1, Map.Entry o2)-> (((Double)(o1.getValue())-(Double)(o2.getValue()))>0 ? -1 : 1);
        PriorityQueue<Map.Entry> mostInformative = new PriorityQueue<Map.Entry>(bySPMeasure);
        for(Map.Entry<DataType, Double> entry : this.yatesMeasure.entrySet()){
            mostInformative.add(entry);
        }
        mostInformative.poll().getKey();
        for(int i = 0; i < 50; i++){
            //System.out.println(mostInformative.poll().getValue().toString());
            mostInformativeDataTypes.add((DataType)mostInformative.poll().getKey());
        }
    }
    */

    // Another idea for identifying informative types
    // Traverse the tree, and select node as informative only if it has higher measure than all of its children
    private void findMostInformative2(DataType _type, Map<DataType, double[]> type_vectors, double[] outcome_vector){
        // Does this type have children?
        if (this.eventsChildren.containsKey(_type)) {
            boolean optimal_level = true;
            // Default Ratio is 0.0, (case when if any child has higher value than parent then
            // consider at a child level). Range is from 0.0 to 1.0
            double optimal_ratio = 0.0;

            double child_greater_count = 0.0;

            double yates = this.yatesMeasure.get(_type);
            Set<DataType> child_types = this.eventsChildren.get(_type);

            // Count the number of children with higher chi-square value than current node
            for (DataType _child : child_types) {
                if(this.yatesMeasure.get(_child) > yates){
                    child_greater_count = child_greater_count + 1;
                    //optimal_level = false;
                }
            }
            // Check the ratio of the number of children with higher chi-square value
            if(child_greater_count/child_types.size() > optimal_ratio){
                optimal_level = false;
            }
            // If the previous condition is met, set the current level as informative
            if(optimal_level && yatesMeasure.get(_type) != null){
                mostInformativeDataTypes.add(_type);
                // Keep Track of frequency of informative nodes
                informativeFrequency.put(_type, eventsEntityCount.get(_type));
            // If not, consider if the children are informative
            }else{
                for (DataType _child : child_types) {
                    findMostInformative2(_child, type_vectors, outcome_vector);
                }
            }
        }else{
            mostInformativeDataTypes.add(_type);
            // Keep Track of frequency of informative nodes
            informativeFrequency.put(_type, eventsEntityCount.get(_type));
        }
        // If no children, we are done in this branch
    }

    // Compute the Yates chi-square value for a given node
    private static double computeChiSquare(double[] type_vector, double[] outcome_vector) {
        // Create a 2x2 Contingency table
        double[][] table = new double[2][2];
        for (int i = 0; i < type_vector.length; i++) {
            if (type_vector[i] == 1.0 && outcome_vector[i] == 1.0) {
                table[0][0]++;
            } else if (type_vector[i] == 1.0 && outcome_vector[i] == 0.0) {
                table[1][0]++;
            } else if (type_vector[i] == 0.0 && outcome_vector[i] == 1.0) {
                table[0][1]++;
            } else {
                table[1][1]++;
            }
        }

        // Check for edge case
        if(((table[0][0] + table[1][0]) * (table[0][0] + table[0][1])
                * (table[1][1] + table[1][0]) * (table[1][1] + table[0][1]))==0){
            return 0.0;
        }
        // Calculate the Yates Chi-square value with continuity correction
        double n = table[0][0] + table[1][0] + table[0][1] + table[1][1];
        double chi_sq_yates = n * Math.pow(Math.max(Math.abs(table[0][0] * table[1][1] - table[1][0] * table[0][1]) - (n / 2),0.0), 2)
                / ((table[0][0] + table[1][0]) * (table[0][0] + table[0][1])
                * (table[1][1] + table[1][0]) * (table[1][1] + table[0][1]));
        return chi_sq_yates;
    }

    // Finds frequency of events of leaf nodes
    private void computeLeafFrequency(DataType _type){
        if (this.eventsChildren.containsKey(_type)) {
            Set<DataType> child_types = this.eventsChildren.get(_type);
            for (DataType _child : child_types) {
                computeLeafFrequency(_child);
            }
        }else{
            leafFrequency.put(_type, eventsEntityCount.get(_type));
        }
    }
/*
    // Another statistic that was considered
    private double computeSensitivity(double[] type_vector, double[] outcome_vector){
        return findMatches(type_vector, outcome_vector);
    }

    private double computerPredictability(double[] type_vector, double[] outcome_vector){
        return findMatches(type_vector, outcome_vector);
    }

    //Given v2 finds matched in v2
    private double findMatches(double[] v1, double[] v2){
        double total = 0.0;
        double matched = 0.0;
        for(int i = 0; i < v1.length; i++){
            if(v2[i] == 1.0){
                total = total + 1.0;
                if(v1[i] == 1.0){
                    matched = matched + 1.0;
                }
            }
        }
        if(total == 0.0){
            return -1.0;
        }else {
            return matched / total;
        }
    }
    */

    // Looks for most data types that have the most distinguishable ancestors
    protected void identifyScentingRank() {
        for (DataType _root : rootDataTypes) {
            this.isRoot.put(_root, true);
            findScentRank(_root);
        }
    }

    // Gives each data type a number corresponding to how distinguishable ancestors are
    private void findScentRank(DataType _type) {
        // Does this node have children?
        if (this.eventsChildren.containsKey(_type)) {
            Set<DataType> child_types = this.eventsChildren.get(_type);
            LinkedList<Double> scent_rank_list = new LinkedList<Double>();

            // Calculate the scent rank for all ancestors
            computeScentRankInTree(_type, scent_rank_list);
            double scent_max = -Double.MAX_VALUE;
            // Find max in scent vector
            for(int i = 0; i < scent_rank_list.size(); i++){
                scent_max = Double.max(scent_rank_list.get(i),scent_max);
            }
            // Set maximum value to the scent rank
            this.scentRank.put(_type, scent_max);

            // Find scent rank for all children
            for (DataType _child : child_types) {
                findScentRank(_child);
            }
            // If not it has no ancestors
        }else{
            this.scentRank.put(_type, -1.0);
        }
    }

    // Find scent vector (list of highest distinguishability between all sub tree levels)
    private void computeScentRankInTree(DataType _type, LinkedList<Double> all_max_diff){
        // Does this node have children?
        if (this.eventsChildren.containsKey(_type)) {
            double child_min = Double.MAX_VALUE;
            double child_max = -Double.MAX_VALUE;
            Set<DataType> child_types = this.eventsChildren.get(_type);
            // Determine the most extreme children
            for (DataType _child : child_types) {
                child_min = Double.min(this.eventsCorrelation.get(_child),child_min);
                child_max = Double.max(this.eventsCorrelation.get(_child),child_max);
            }
            // Consider the absolute value as a metric
            all_max_diff.add(Math.abs(child_max-child_min));
            // Search at further ancestor levels
            for (DataType _child : child_types) {
                computeScentRankInTree(_child, all_max_diff);
            }
            // If it not it cannot be a scented node
        }else{
            all_max_diff.add(-1.0);
        }
    }
    /* Unimplemented code for finding similar events
    protected void identifySimilarTypes(Map<DataType, double[]> type_vectors){
        for (DataType _root : rootDataTypes) {
            findSimilarTypes(_root, type_vectors);
        }
        //identifyRelatedEvents(,type_vectors.keySet());
    }

    private void identifyRelatedEvents(DataType _type, Set<DataType> all_data_types){
    }

    private void findSimilarTypes(DataType _type, Map<DataType, double[]> type_vectors){
        Map<DataType, Double> similarity_map = new HashMap();
        double[] type_vector_focus = type_vectors.get(_type);
        if(this.mostInformativeDataTypes.contains(_type) && this.eventsChildren.containsKey(_type)){
            //computeAllSimilarity(type_vectors, type_vector_focus, similarity_map);
        }

        this.similarDataTypes.put(_type, similarity_map);

        // Does this node have children?
        if (this.eventsChildren.containsKey(_type)) {
            Set<DataType> child_types = this.eventsChildren.get(_type);
            // Find similar types for children
            for (DataType _child : child_types) {
                findSimilarTypes(_child, type_vectors);
            }
        }
    }

    private void computeAllSimilarity(Map<DataType, double[]> type_vectors, double[] type_vector_focus,
                                      Map<DataType, Double> similarity_map){
        for (DataType _type : type_vectors.keySet()) {
            //double similarity = computeSimilarity(type_vector_focus, type_vectors.get(_type));
            //similarity_map.put(_type, similarity);
        }
    }

    private static double computeSimilarity(double[] type_vector_focus, double[] type_vector_other) {
        // Create a 2x2 Contingency table
        double[][] table = new double[2][2];
        for (int i = 0; i < type_vector_focus.length; i++) {
            if (type_vector_focus[i] == 1.0 && type_vector_other[i] == 1.0) {
                table[0][0]++;
            } else if (type_vector_focus[i] == 1.0 && type_vector_other[i] == 0.0) {
                table[1][0]++;
            } else if (type_vector_focus[i] == 0.0 && type_vector_other[i] == 1.0) {
                table[0][1]++;
            } else {
                table[1][1]++;
            }
        }
        double jaccard = table[0][0]/(table[0][0]+table[1][0]+table[0][1]);
        return jaccard;
    }
    */
    @Override
    public JSONObject toJSON() throws JSONException {
        if (this.jsonData == null) {
            JSONObject _json = new JSONObject();
            _json.put("size", size);
            _json.put("avgoutcome", avgOutcome);
            _json.put("attrs", attributesToJSON());
            _json.put("events", eventsToJSON());
            _json.put("outcomes", outcomesToJSON());

            // Store the json object for next time.
            this.jsonData = _json;
        }
        return this.jsonData;
    }

    public JSONArray outcomesToJSON() throws JSONException {
        JSONArray _outcomes = new JSONArray();
        // Start with a time=0, 0 with outcome entry.
        JSONObject outcome_count = new JSONObject();
        outcome_count.put("time", 0);
        outcome_count.put("count", 0);
        _outcomes.add(outcome_count);

        int count_so_far = 0;
        for (Long _time : outcomesByTimeAfter.keySet()) {
            outcome_count = new JSONObject();
            // Send a cumulative count...
            count_so_far += outcomesByTimeAfter.get(_time);
            outcome_count.put("time", _time);
            outcome_count.put("count", count_so_far);
            _outcomes.add(outcome_count);
        }

        return _outcomes;
    }

    protected JSONObject attributesToJSON() throws JSONException {
        JSONObject _attrs = new JSONObject();

        // For each type of attribute...
        for (DataType _type : attributes.keySet()) {
            // Get all value/count pairs for the given attribute.
            JSONObject one_attr_stats = new JSONObject();
            Map<Object, Integer> type_stats = attributes.get(_type);
            for (Object attr_value : type_stats.keySet()) {
                // Put the current value/count pair into the object for this attribute.
                one_attr_stats.put(attr_value.toString(), type_stats.get(attr_value));
            }

            // Also add a value indicating what kind of attribute this is.
            JSONObject one_attr_type = _type.toJSON();

            // Add the data for the given attribute to the object with all attribute data.
            JSONObject attr_data = new JSONObject();
            attr_data.put("type", one_attr_type);
            attr_data.put("stats", one_attr_stats);
            _attrs.put(_type.getCode(), attr_data);
        }

        return _attrs;
    }

    protected JSONObject eventsToJSON() throws JSONException {
        JSONObject _events = new JSONObject();

        // For each type of event...
        for (DataType _type : eventsCorrelation.keySet()) {
            // Get the count for this data type and add to the overall list of stats.
            JSONObject one_event = new JSONObject();
            one_event.put("id", _type.getID());
            // If this data type has a parent, include its id.
            if (_type.getParent() != null) {
                one_event.put("parent_id", _type.getParent().getID());
            }
            // If this data type has children, include the set of ids.
            if (eventsChildren.containsKey(_type)) {
                Set<DataType> child_types = eventsChildren.get(_type);
                Collection<Integer> child_ids = child_types.parallelStream()
                        .map(child_type -> child_type.getID())
                        .collect(Collectors.toSet());
                one_event.put("child_ids", child_ids.toArray());
            }
            one_event.put("cat", _type.getCategory());
            one_event.put("code", _type.getCode());
            one_event.put("label", _type.getLabel());
            // TODO: Must figure out proper metric.
            one_event.put("informative", this.mostInformativeDataTypes.contains(_type));
            one_event.put("yates", this.yatesMeasure.get(_type));
            one_event.put("pValue", this.pValue.get(_type));
            one_event.put("scent", this.scentRank.get(_type));

            if (this.isRoot.get(_type) != null){
                one_event.put("root", true);
            }else {
                one_event.put("root", false);
            }
            //one_event.put("informative", true);
            one_event.put("corr", eventsCorrelation.get(_type));

            // Note that we have correlation data for all events and their parents!  We only have frequency counts
            // for events that actually occur in the database.
            if (eventsEntityCount.containsKey(_type)) {
                one_event.put("totalcount", eventsTotalCount.get(_type));
                one_event.put("entitycount", eventsEntityCount.get(_type));
            }

            // Add the data for the given event to the object with all event data.
            _events.put(String.valueOf(_type.getID()), one_event);
        }

        return _events;
    }

    public static double log2(double num) {
        return (Math.log(num)/Math.log(2));
    }
}
