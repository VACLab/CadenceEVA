package edu.unc.vaclab.cadence.data.connectors;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.data.vocab.CodeReplacementMapper;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.util.*;

/**
 * Created by gotz on 6/5/17.
 */
public class CSVWithOHDSIVocabDataConnector extends CadenceDataConnector {

    private HashMap<String,ArrayList<Event>> eventData = new HashMap<>();
    private HashMap<String,HashMap<AttributedDataType,Object>> attributeData = new HashMap<>();
    private HashMap<DataType,HashSet<String>> pidByDataType = new HashMap<>();
    private HashMap<String,Entity> entityData = new HashMap<>();
    private Vocabulary vocabulary = null;
    private CodeReplacementMapper mapper = null;

    /**
     * Constructor
     */
    public CSVWithOHDSIVocabDataConnector() {
    }

    @Override
    public void init(String _directory, Vocabulary _vocab, List<String> event_classes) {
        // Begin with a serialized version of the vocabulary if it is available.
        boolean serialized_success = _vocab.deserializeFromFile(_directory + "/vocab.ser");

        // Attempt to connect the vocabulary, which will allow us to expand on the serialized data if needed when
        // we load the data files.
        if (!_vocab.isConnected()) {
            _vocab.connect();
        }

        // First read the attributes.
        attributeData = parseAttributes(_directory + "/attributes.csv", _vocab);

        // Then the events, which requires a mapper.
        mapper = new CodeReplacementMapper(_directory + "/code_map.csv");
        eventData = parseEvents(_directory + "/events.csv", _vocab, event_classes);

        // Serialize the vocabulary (for offline use of the software...)
        if (_vocab.hasChanged()) {
            _vocab.serializeToFile(_directory + "/vocab.ser");
        }

        // Combine attributes and events to Entity objects.
        entityData = buildEntitiesFromAttributesWithEvents();

        vocabulary = _vocab;

        // Dump out some basic stats to the console for QA purposes.
        /**
        System.out.println("==============================");
        System.out.println("DATA CONNECTOR INITIALIZED:");
        int patient_count = eventData.size();
        System.out.println("Patient count: " + patient_count);
        int event_count = eventData.values().stream().mapToInt(event_list -> event_list.size()).sum();
        System.out.println("Event type count: " + vocabulary.getEventTypeCount());
        System.out.println("Event leaf count: " + pidByDataType.keySet().stream().mapToInt(e -> vocabulary.getChildren(e.getCategory(), e.getCode()) == null ? 1: 0).sum());
        System.out.println("Event count: " + event_count);
        System.out.println("Avg seq length: : " + event_count/(float)patient_count);
        System.out.println("==============================");
        **/
    }

    @Override
    public long getSize() {
        // Assume that the number of unique IDs (keys) in the attributeData map represents the number of entities
        // in the CSV data source.
        return attributeData.size();
    }

    /**
     * Grows the span to include (1) any events with the same timestamp as the first event in the span even if before
     * the first span event in the event list; and (2) any events with the same timestamp as the last event in the span even
     * if after the last span event in the event span.
     *
     * @param _span
     * @param event_list
     */
    private void growSpan(EventSpan _span, List<Event> event_list) {
        long start_time = event_list.get(_span.getStart()).getTimestamp();
        long end_time = event_list.get(_span.getEnd()-1).getTimestamp();

        // Grow the start of the span first.
        int new_start = _span.getStart();
        while ((new_start>0) && (event_list.get(new_start-1).getTimestamp() == start_time )) {
            new_start--;
        }

        // Now grow the end of the span.
        int new_end = _span.getEnd();
        int _length = event_list.size();
        while ((new_end<_length) && (event_list.get(new_end).getTimestamp() == end_time)) {
            new_end++;
        }

        // Finally, we should extend the end by one so that it points to the next event BEYOND the span (i.e., that the
        // end index is not part of the span range, allowing us to iterate up to but not including the end).
        // DHG - THIS IS NOT NEEDED. REMOVE IT.
        //new_end++;

        // Update the span and return.
        _span.setStart(new_start);
        _span.setEnd(new_end);
    }

    public Cohort query(Query _query) {
        Cohort matching_cohort = new Cohort(_query);

        // Checks each patient in the dataset to see if they are to be included, returning a cohort with all matching
        // patients and the time window of events that match the specified temporal constraints of the query.
        //
        // The algorithm is as follows:
        // 1. Check for all events in query constraints.  Find intersection of all ID sets.
        // 2. For each patient in the intersection:
        //         2a. Check demographics, skipping to next patient if constraints not met
        //         2b. Check for events in order as required with time constraints as required, skipping to next
        //             patient if constraints not met
        //         2c. Find outcome label
        //         2d. Add entity, window of temporal events, and label to cohort
        // 3. Return the cohort
        //
        // This approach is taken because of the assumption that data is sparse.  This means that most patients will
        // NOT meet the query constraints.  Therefore, we follow a design where the "expensive" operation of time
        // constraint checking will only happen for patients who at least have the requisite events somewhere in their
        // timeline.  Moreover, the algorithm defers the expensive time constraint checking to be done only after
        // checking for demographics, which is relatively cheap to test compared to traversing the event list.

        // 1. Get a set containing all data types included in the query.
        Set<DataType> event_type_set = _query.getSetOfEventConstraintDataTypes();
        Set<String> id_set = null;
        for (DataType data_type : event_type_set) {
            if (id_set == null) {
                id_set = getIDsWithDataType(data_type);
            }
            else {
                id_set.retainAll(getIDsWithDataType(data_type));
            }
        }
        // If the query is empty, the set will be null.  Return an empty cohort.
        if (id_set == null) {
            return matching_cohort;
        }

        // 2. Iterate over each patient ID in the intersection set.
        for (String _id : id_set) {
            // 2a. Check to see if this ID meets the demographic constraints.  We only proceed to the next step if
            // the demographic constraints are satisfied.
            Constraint attribute_constraints = _query.getAttributeConstraints();
            if ((attribute_constraints == null) || (meetsDemographicsConstraints(_id, _query.getAttributeConstraints()))) {
                // 2b. Time to check for the temporal events, occurring in the required order.
                EventSpan matching_span = applyTemporalConstraints(eventData.get(_id), 0, _query.getTemporalConstraints());

                // If no match was found, matching span will be null...
                if (matching_span != null) {

                    if (matching_span.getEnd() > eventData.get(_id).size()) {
                        System.out.println("/ . / . / . / . / . / . / . / . / . /");
                        System.out.println("ERROR! MATCHING SPAN TOO BIG BEFORE GROWING.");
                        System.out.println("/ . / . / . / . / . / . / . / . / . /");
                        System.out.flush();
                    }

                    // 2c. Grow the span as needed to account for simultaneous events.
                    growSpan(matching_span, eventData.get(_id));

                    if (matching_span.getEnd() > eventData.get(_id).size()) {
                        System.out.println("================");
                        System.out.println("ERROR! END OF SPAN IS TOO LARGE!");
                        System.out.println("================");
                        System.out.flush();
                    }

                    // 2d. Find the outcome label...
                    // We do this by looking for the outcome constraints AFTER the end of the matching span.
                    float _outcome = 0.0f;
                    Long outcome_time_gap = applyOutcomeConstraints(eventData.get(_id), matching_span.getEnd()+1, _query.getOutcomeConstraints());
                    if (outcome_time_gap != null) {
                        _outcome = 1.0f;
                    }

                    // 2e. Add entity, window of temporal events, and outcome label to cohort
                    Entity matching_entity = new Entity(_id);
                    matching_entity.setAttributes(attributeData.get(_id));
                    matching_entity.setEventList(eventData.get(_id));
                    matching_cohort.putEntity(_id, matching_entity);
                    matching_cohort.putSpan(_id, matching_span);
                    matching_cohort.putOutcome(_id, new Outcome(_outcome, outcome_time_gap));
                }
            }
        }

        // Dump out some basic stats to the console for QA purposes.
        /**
        System.out.println("==============================");
        System.out.println("QUERY COMPLETED:");
        int patient_count = matching_cohort.getEntities().size();
        System.out.println("Patient count: " + patient_count);
        System.out.println("Event type count: " + matching_cohort.getStats().getEventsEntityCount().size());
        System.out.println("Event leaf count: " + matching_cohort.getStats().getEventsEntityCount().keySet().stream().mapToInt(e -> vocabulary.getChildren(e.getCategory(), e.getCode()) == null ? 1: 0).sum());
        int event_count = matching_cohort.getSpans().values().stream().mapToInt(_span -> _span.size()).sum();
        System.out.println("Event count: " + event_count);
        System.out.println("Avg seq length: : " + event_count/(float)patient_count);
        System.out.println("==============================");
        **/
        return matching_cohort;
    }

    private Long applyOutcomeConstraints(List<Event> event_list, int start_index, Constraint temporal_constraint) {
        // First, we have to see if there is an opening time gap.  If so, we first look for the "remainder" of the constraints
        // as a first step, then look to see if that span occurs within the required time gap.
        if ((temporal_constraint instanceof RelationConstraint) && (((RelationConstraint) temporal_constraint).getConstraintA() == null)) {
            RelationConstraint _relation = (RelationConstraint)temporal_constraint;
            // We have an opening gap!  Calculate the span for after the gap.
            EventSpan _span = applyTemporalConstraintsHelper(event_list, start_index, _relation.getConstraintB());

            if (_span == null) {
                // This means we have not found the outcome constraints.
                return null;
            }
            else {
                // Next we need to see how close the span's start time is to the start index time.  This is the time gap
                // between the end of the span matching the query's temporal constraints, and the start of the outcome
                // pattern.
                long time_gap = event_list.get(_span.getStart()).getTimestamp() - event_list.get(start_index).getTimestamp();

                // Is the time gap acceptable?
                switch (_relation.getType()) {
                    case THEN_BEYOND:
                        if (time_gap > _relation.getTimeConstraint().toMillis()) {
                            return time_gap;
                        }
                        break;
                    case THEN_WITHIN:
                        if (time_gap < _relation.getTimeConstraint().toMillis()) {
                            return time_gap;
                        }
                        break;
                    case THEN_EQUAL:
                        if (time_gap == _relation.getTimeConstraint().toMillis()) {
                            return time_gap;
                        }
                        break;
                }
                return null;
            }
        }
        else {
            EventSpan _span = applyTemporalConstraintsHelper(event_list, start_index, temporal_constraint);
            if (_span == null) {
                return null;
            }
            else {
                long time_gap = event_list.get(_span.getStart()).getTimestamp() - event_list.get(start_index).getTimestamp();
                return time_gap;
            }
        }
    }

    private EventSpan applyTemporalConstraints(List<Event> event_list, int start_index, Constraint temporal_constraint) {
        // First, we have to see if there is an opening time gap.  If so, we first solve for the "remainder" of the constraints
        // as a first step, then extend the span (if we have one) to respect the gap.
        if ((temporal_constraint instanceof RelationConstraint) && (((RelationConstraint) temporal_constraint).getConstraintA() == null)) {
            // We have an opening gap!  Calculate the span for after the gap.
            EventSpan _span = applyTemporalConstraintsHelper(event_list, start_index, ((RelationConstraint) temporal_constraint).getConstraintB());

            if (_span == null) {
                return null;
            }
            else {
                // Then extend the span to an earlier start to cover the gap.  Look backwards until we extend past the allowed time gap.
                int extended_start_index = _span.getStart();
                long span_start_time = event_list.get(_span.getStart()).getTimestamp();
                long desired_gap = ((RelationConstraint) temporal_constraint).getTimeConstraint().toMillis();
                while ((extended_start_index > 0) && ((span_start_time - event_list.get(extended_start_index - 1).getTimestamp()) < desired_gap)) {
                    extended_start_index--;
                }
                // Update the start of the span and return.
                _span.setStart(extended_start_index);
                return _span;
            }
        }
        else {
            return applyTemporalConstraintsHelper(event_list, start_index, temporal_constraint);
        }
    }

    /**
     * Recursively applies the event constraints, finding the earliest minimally enclosing time window that matches
     * the provided constraints. Returns null if no match is found.
     * @param event_list The list of events to search.
     * @param start_index The starting index for the search.  Should be "0" when called initially.  The value will
     *                    be used to support recursive traversal of the event list.
     * @param temporal_constraint The constraints that need to be matched.
     * @return
     */
    private EventSpan applyTemporalConstraintsHelper(List<Event> event_list, int start_index, Constraint temporal_constraint) {
        // If the temporal constraint is a relation constraint, we need to check the two sides of the relation, determine
        // if the two sides meet any duration constraints (e.g., THEN_WITHIN vs THEN_BEYOND), and (if a match has been
        // found) merge the two event spans.
        if (temporal_constraint instanceof RelationConstraint) {
            RelationConstraint _relation = ((RelationConstraint) temporal_constraint);

            // Match part A.
            EventSpan span_a = applyTemporalConstraintsHelper(event_list, start_index, _relation.getConstraintA());

            // If part A fails to match, the entire query fails to match.
            if (span_a == null) {
                return null;
            }
            else {
                // Part A found a match.  Now time to match against part B of the relation.  BUT! Only if Part B is not
                // null.  We handle the "null part B" as a special case.
                if (_relation.getConstraintB() == null) {
                    // This means we have a time gap at the very end of the query. We need to grow the span from part A
                    // such that the end is extended to cover the requested time gap.
                    int extended_end_index = span_a.getEnd();
                    long span_end_time = event_list.get(Math.min(event_list.size()-1, span_a.getEnd())).getTimestamp();
                    long desired_gap = _relation.getTimeConstraint().toMillis();
                    while ((extended_end_index < event_list.size()-2) && ((event_list.get(extended_end_index+1).getTimestamp() - span_end_time) < desired_gap)) {
                        extended_end_index++;
                    }
                    // Update the end of the span and return.
                    span_a.setEnd(extended_end_index);
                    return span_a;
                }

                int start_index_for_next_constraint = (span_a.isSoftSpan() ? span_a.getEnd() : span_a.getEnd()+1);
                EventSpan span_b = applyTemporalConstraintsHelper(event_list, start_index_for_next_constraint, _relation.getConstraintB());

                // If part B fails to match, we again return null to signify that the entire query failed.
                if (span_b == null) {
                    return null;
                }
                else {
                    // Check the distance between the two spans (in time) if required.
                    switch (_relation.getType()) {
                        case THEN_BEYOND: {
                            // If the time gap is too short, return null to signify a failed match.
                            long time_gap = event_list.get(span_b.getStart()).getTimestamp() - event_list.get(span_a.getEnd()).getTimestamp();
                            if (time_gap < _relation.getTimeConstraint().toMillis()) {
                                return null;
                            }
                        }
                        case THEN_WITHIN: {
                            // If the time gap is too long, return null to signify a failed match.
                            long time_gap = event_list.get(span_b.getStart()).getTimestamp() - event_list.get(span_a.getEnd()).getTimestamp();
                            if (time_gap > _relation.getTimeConstraint().toMillis()) {
                                return null;
                            }
                        }
                        case THEN_EQUAL: {
                            // If the time gap is not exactly correct, return null to signify a failed match.
                            long time_gap = event_list.get(span_b.getStart()).getTimestamp() - event_list.get(span_a.getEnd()).getTimestamp();
                            if (time_gap != _relation.getTimeConstraint().toMillis()) {
                                return null;
                            }
                        }
                    }

                    // We have a matching set of time gaps that meet all requirements for the query. Merge the two
                    // spans and return.
                    span_a.setEnd(span_b.getEnd());
                    return span_a;
                }
            }
        }
        // If the temporal constraint is a single constraint, we need to look for the correct event and return a time
        // span (or null if not found).
        else {
            // The behavior here depends on the type of constraint.
            if (temporal_constraint instanceof DateConstraint) {
                // This is a specific date.  How we handle this depends on if the DateConstraint is a terminal constraint
                // (appearing at the end of the query) or not.  First, find the index of the first event ON OR AFTER the
                // date.
                int i=start_index;
                while ((i<event_list.size()) && (event_list.get(i).getTimestamp() < ((DateConstraint) temporal_constraint).getDateValue().getTime())) {
                    i++;
                }

                // If the event is terminal, we actually want the index of the last event BEFORE the date.
                if (((DateConstraint) temporal_constraint).isTerminal()) {
                    // We want the find the last event BEFORE the date.
                    return new EventSpan(i-1,i, true);
                }
                else {
                    // We want the find the first event ON OR AFTER the date.
                    return new EventSpan(i,i+1, true);
                }
            }
            // If we are looking for a specific type, we need to iterate over the event sequence to find it.
            else if (temporal_constraint instanceof EventTypeConstraint) {
                EventTypeConstraint event_constraint = (EventTypeConstraint)temporal_constraint;
                int i=start_index;
                boolean not_found = true;
                while ((i<event_list.size()) && (not_found)) {
                    // Is this the event we are seeking?
                    if (event_list.get(i).getType().isEqualToOrChildOf(event_constraint.getDataType())) {
                        not_found = false;
                    }
                    // If not, we increment the index.
                    else {
                        i++;
                    }
                }

                // Return depending on if we've found the target event (or not).
                if (not_found) {
                    return null;
                }
                else {
                    // DHG
                    // return new EventSpan(i, i, false);
                    // Grow span from i to account for simultaneous events.
                    EventSpan _span = new EventSpan(i, i+1, false);
                    growSpan(_span, event_list);
                    return _span;
                }

            }
            return null;
        }
    }

    private boolean meetsDemographicsConstraints(String _id, Constraint attribute_constraints) {
        // Get attribute data for this id.
        HashMap<AttributedDataType,Object> attribs_for_id = this.attributeData.get(_id);

        // Recursively check the constraints.
        if (attribute_constraints instanceof AttributeConstraint) {
            AttributeConstraint _constraint = (AttributeConstraint)attribute_constraints;
            return _constraint.test(attribs_for_id.get(_constraint.getAttributeType()));
        }
        else {
            RelationConstraint _relation = (RelationConstraint)attribute_constraints;
            if (meetsDemographicsConstraints(_id, _relation.getConstraintA()) &&
                    meetsDemographicsConstraints(_id, _relation.getConstraintB())) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    // Retrieves a set of IDs for all entities which have one or more of the specified data type.
    private Set<String> getIDsWithDataType(DataType data_type) {
        // Get all descendants of this data type.
        List<DataType> matching_types = vocabulary.getAllDescendants(data_type);

        // Compute a union of patient IDs across all matching types.
        Set<String> _pids = new HashSet<>();
        Set<String> new_pids = pidByDataType.get(data_type);
        if (new_pids != null) {
            _pids.addAll(new_pids);
        }
        for (DataType child_type : matching_types) {
            new_pids = pidByDataType.get(child_type);
            if (new_pids != null) {
                _pids.addAll(new_pids);
            }
        }

        return _pids;
    }

    private HashMap<String,HashMap<AttributedDataType,Object>> parseAttributes(String attributes_filename, Vocabulary _vocab) {
        HashMap<String,HashMap<AttributedDataType,Object>> attribute_map = new HashMap<>();

        // Next read in the events file.
        try {
            CSVParser input_parser = CSVParser.parse(new File(attributes_filename), StandardCharsets.UTF_8, CSVFormat.RFC4180.withHeader());

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String _id = _item.get("id");
                String _var = _item.get("variable");
                String _val = _item.get("value");
                String _type = _item.get("type");

                // Get the matching attribute map.
                HashMap<AttributedDataType,Object> entity_attributes = attribute_map.get(_id);
                if (entity_attributes == null) {
                    entity_attributes = new HashMap<>();
                    attribute_map.put(_id, entity_attributes);
                }

                // Update the vocabulary to reflect this new attribute data type.
                AttributedDataType data_type = _vocab.getAttributedDataType("ATTRIBUTE", _var, _type, new TreeSet<>());

                // If it is categorical, store the value in the list of valid options for this attribute.
                if (_type.equals("string")) {
                    data_type.getValueDomain().add(_val);
                }

                // Store the data in the map for this id.
                entity_attributes.put(data_type, convertValueToType(_val, _type));

                // Index this patient in the pidByDataType index structure.
                pidByDataType.computeIfAbsent(data_type, t -> new HashSet<>()).add(_id);
            }
        } catch (IOException _e) {
            _e.printStackTrace();
        }

        return attribute_map;
    }

    /**
     * Parses the events CSV file.
     * @param events_filename The CSV file with event data.
     * @return A map containing lists of events indexed by entity ID.
     */
    private HashMap<String, ArrayList<Event>> parseEvents(String events_filename, Vocabulary _vocab, List<String> event_classes) {
        // TODO: Generate error if UNSORTED data is detected...

        HashMap<String,ArrayList<Event>> data_map = new HashMap<>();

        // Open the vocabulary server's DB connection.
        _vocab.connect();

        // Next read in the events file.
        try {
            // Buffered reader to read 0.5MB at a time.
            BufferedReader _buff = new BufferedReader(new FileReader(events_filename), 1048576/2);
            CSVParser input_parser = CSVFormat.RFC4180.withHeader().parse(_buff);

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String _id = _item.get("id");
                Date _date = null;
                try {
                    _date = dateFormat.parse(_item.get("date"));
                }
                catch (ParseException _e) {
                    try {
                        _date = alternativeDateFormat.parse(_item.get("date"));
                    }
                    catch (ParseException _e2) {
                        System.out.println("=====\nERROR IN DATA FILE:");
                        System.out.println("id = " + _item.get("id"));
                        System.out.println("date = " + _item.get("date"));
                        System.out.println("codeclass = " + _item.get("codeclass"));
                        System.out.println("code = " + _item.get("code"));
                        System.out.println("=====");
                        System.out.println("");
                        System.out.println("SKPPING EVENT DUE TO INVALID OR MISSING DATE.");
                        System.out.flush();

                        continue;
                    }
                }
                catch (Exception _e3) {
                    System.out.print("ERROR");
                }
                String code_class = _item.get("codeclass");
                String _code = _item.get("code");

                // Run the code through the mapper to make sure it isn't one we want to replace with a replacement code.
                _code = mapper.map(code_class, _code);

                // The code mapper might produce a "null" code, indicating that we should skip the event and move on to
                // the next code.
                if (_code != null) {
                    // Is the class one that should be included when loading?  Or one to skip?
                    if ((event_classes == null) || (event_classes.contains(code_class))) {
                        // Is this a new ID?  If so, create an entry in the data map.
                        if (!data_map.containsKey(_id)) {
                            data_map.put(_id, new ArrayList<>());
                        }
                        DataType _type = _vocab.getEventType(code_class, _code);

                        if (_type == null) {
                            System.out.println("======================================");
                            System.out.println("CODE FAILED TO RESOLVE:");
                            System.out.println("class: " + code_class);
                            System.out.println("code:  " + _code);
                            System.out.println("======================================");
                            System.out.flush();
                        }
                        data_map.get(_id).add(new Event(_type, _date.getTime()));

                        // Index this patient in the pidByDataType index structure.
                        pidByDataType.computeIfAbsent(_type, t -> new HashSet<>()).add(_id);
                    }
                }
                else {
                    System.out.println("======================================");
                    System.out.println("CODE SKIPPED DUE TO MAPPING FILE RULE:");
                    System.out.println("class: " + code_class);
                    System.out.println("code:" + _item.get("code"));
                    System.out.println("======================================");
                    System.out.flush();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        // Close the vocabulary server's DB connection.
        _vocab.disconnect();

        return data_map;
    }

    // Combines data from attributes and events into Entity objects and creates a single map
    // which points to the combined data structures.
    private HashMap<String,Entity> buildEntitiesFromAttributesWithEvents() {
        HashMap<String,Entity> entity_map = new HashMap<>();

        for (String _id : eventData.keySet()) {
            Entity _entity = new Entity(_id);
            _entity.setAttributes(attributeData.get(_id));
            _entity.setEventList(eventData.get(_id));
        }

        return entity_map;
    }

    @Override
    public void teardown() {
        attributeData.clear();
        eventData.clear();
        pidByDataType.clear();
    }
}
