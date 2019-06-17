package edu.unc.vaclab.cadence.data.connectors;

import edu.unc.vaclab.cadence.data.*;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Created by gotz on 6/5/17.
 */
public class SimpleCSVDataConnector extends CadenceDataConnector {
    private SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    private SimpleDateFormat alternativeDateFormat2 = new SimpleDateFormat("yyyy-MM-dd");
    private HashMap<String,ArrayList<Event>> eventData = new HashMap<>();
    private HashMap<String,HashMap<String,Object>> attributeData = new HashMap<>();
    private ArrayList<DataType> dataTypeList = new ArrayList<>();
    private HashMap<DataType, HashSet<String>> dataTypePatCounter = new HashMap<>();
    private long totalEvents = 0;

    /**
     * Constructor
     */
    public SimpleCSVDataConnector() {
    }

    @Override
    public void init(String _directory, Vocabulary _vocab, List<String> event_classes) {
        // First read the attributes.
        attributeData = parseAttributes(_directory + "/attributes.csv");
        // Next read the event dictionary.
        dataTypeList = parseEventDictionary(_directory + "/eventdict.csv");
        // Finally, the events.
        eventData = parseEvents(_directory + "/events.csv");
    }

    @Override
    public long getSize() {
        // Assume that the number of unique IDs (keys) in the attributeData map represents the number of entities
        // in the CSV data source.
        return attributeData.size();
    }

    public Cohort query(Query _query) {
        System.err.println("NOT YET IMPLEMENTED.");
        return null;
    }


    /*
    @Override
    public Cohort query(Query _query) { //query should come from here, change the interface
        Cohort cohort = new Cohort();

        // patient temp for updating their outcome
        HashSet<String> patTemp = new HashSet<>();
        // outcome event of this query
        Constraint outcome_constraint = _query.getOutcomeConstraints();
        // patientResult[0] = if outcome event exist, patientResult[1] = start event id, patientResult[2] = end event id, patientResult[3] = mark for "Date" type query
        int[] patientResult = new int[4];
        // largest event id for each patient
        HashMap<String, Integer> eventIdSeen = new HashMap<>();

        /*

        Search_Patient:
        for (String patient:eventData.keySet()) {
            // check the demographic info (without timestamp) for the patient
            HashMap<String, Object> patientInfo = attributeData.get(patient);

            for(String p : _query.getPatientAttr().keySet()) {
                if(patientInfo.get(p).toString().compareTo(_query.getPatientAttr().get(p)) != 0) continue Search_Patient;
            }
            ArrayList<Event> eventList = eventData.get(patient);
            // event cache for each patient
            HashMap<DataType, ArrayList<Integer>> eventCache = new HashMap<>();
            patientResult = new int[] {0, Integer.MAX_VALUE, -1, 0};

            try {
                if(queryTreeTraversal(patientInfo, eventList, _query.getQueryTree(), _query.getQueryTree(), eventCache, 0, new int[] {0}, patientResult, outcomeEvent)) {
                    Cohort.EventInterval patientInCohort = cohort.new EventInterval();
                    patientInCohort.outcome = patientResult[0]==1; // need double check for outcome=false. For every patient in the cohort, check the outcome exist start from end_event_id
                    patientInCohort.start_event_id = patientResult[1];
                    patientInCohort.end_event_id = patientResult[2];
                    cohort.patients.put(patient, patientInCohort);
                    if (patientResult[0]==0) {
                        patTemp.add(patient);
                    }
                    eventIdSeen.put(patient, 0);
                    // update cohort information using the event cache
                    for (DataType t:eventCache.keySet()) {
                        int size = eventCache.get(t).size();
                        eventIdSeen.put(patient, Math.max(eventIdSeen.get(patient),eventCache.get(t).get(size-1)));
                        int sid = binarySearch2(eventCache.get(t),patientResult[1]);
                        int eid = binarySearch2(eventCache.get(t),patientResult[2]);
                        int num_before = sid;
                        int num_between = eid - sid;
                        int num_after = size - eid;
                        if (eid == size-1 && eventCache.get(t).get(size-1) <= patientResult[2]) {
                            num_between++;
                            num_after--;
                        } else if (sid == size-1 && eventCache.get(t).get(size-1) < patientResult[1]) {
                            num_before++;
                            num_after--;
                        }
                        cohort.updatePatientsByDataType(cohort.cohort_before, t, num_before, patient);
                        cohort.updatePatientsByDataType(cohort.cohort_between, t, num_between, patient);
                        cohort.updatePatientsByDataType(cohort.cohort_after, t, num_after, patient);
                        cohort.updateAttr(cohort.event_attr, t, patientInCohort.outcome, patient);
                    }
                }
            } catch (ParseException e) {
                e.printStackTrace();
            }
        }

        // For every patient in the cohort, update counter for events not seen(not in cache)
        // For patients whose outcome is false, need to double check if it is false for events not seen
        // For query start from a certain date, the events before that date will not be in the cache
        for(String p:cohort.patients.keySet()) {
            if(cohort.patients.get(p).outcome) cohort.outcome_counter++;
            // Events after the time window: default for all queries
            for(int i=eventIdSeen.get(p)+1; i<eventData.get(p).size();i++) {
                DataType t = eventData.get(p).get(i).getType();
                boolean outcome = t.compareTo(outcomeEvent)==0;
                // Update cohort for events after the time window
                cohort.updatePatientsByDataType(cohort.cohort_after, t, -1, p);
                cohort.updateAttr(cohort.event_attr, t, outcome, p);
                // Update outcome by double checking events after the time window
                if(patTemp.contains(p) && outcome) cohort.patients.get(p).outcome = true;
            }
            // For query contains "Date", events seen from a certain date
            if(patientResult[3] == 1) {
                for(int i=0; i<cohort.patients.get(p).start_event_id;i++) {
                    DataType t = eventData.get(p).get(i).getType();
                    boolean outcome = t.compareTo(outcomeEvent)==0;
                    cohort.updatePatientsByDataType(cohort.cohort_before, t, -1, p);
                    cohort.updateAttr(cohort.event_attr, t, outcome, p);
                    if(patTemp.contains(p) && outcome) cohort.patients.get(p).outcome = true;
                }
            }

        }

        // Update IG for this cohort
        cohort.calculateIG(getSize(), dataTypePatCounter);

        return  cohort;
    }

    // Offer a event list given a certain event type with the same set of patients
    @Override
    public HashSet<DataType> eventsBySelected(Cohort _cohort, DataType _dataType) {
        Iterator<String> iter = _cohort.event_attr.get(_dataType).cohort_patient_set.iterator();
        ArrayList<Event> events = eventData.get(iter.next());
        // Initialize a set of intersection
        HashSet<DataType> intersection = new HashSet<>();
        for(Event e: events) intersection.add(e.getType());
        while(iter.hasNext()) {
            ArrayList<Event> el = eventData.get(iter.next());
            HashSet<DataType> temp = new HashSet<>();
            for(Event e: el) temp.add(e.getType());
            intersection.retainAll(temp);
        }
        return intersection;
    }

    @Override
    public Object getPatientInfo(String _pid, String _attr) {
        return attributeData.get(_pid).get(_attr);
    }

    // Inorder traversal of the query tree
    private Boolean queryTreeTraversal(HashMap<String, Object> _patientInfo, ArrayList<Event> _eventList, QueryTree _root, QueryTree _par, HashMap<DataType,ArrayList<Integer>> _eventCache, int _curid, int[] curid, int[] _patientResult, DataType _outcomeEvent) throws ParseException {
        if(!ConstructedType.RelationType.RELATIONS.contains(_root.getName())) {
            if(_eventCache.containsKey(_root.getData()) && _curid < _eventList.size()) { // Date, Age --> not in cache. Multiple events with the same event code in the list. The timestamp is sorted as seen, can be further improved by binary search
                int index = binarySearch2(_eventCache.get(_root.getEvent()),_curid);
                int d = _eventCache.get(_root.getEvent()).get(index); //index of the event have seen before
                if(d > _curid) {
                    switch (_par.getName()){
                        case "THEN_WITHIN":
                            if(Long.compare(_eventList.get(d).getTimestamp(), _eventList.get(_curid).getTimestamp()) <= (int)_par.getValue()[0]*86400000L) {
                                curid[0] = d+1; // record position
                                break;
                            }
                        case "THEN_BEYOND":
                            if (_curid >= _eventList.size()) return false; //check bound
                            if(Long.compare(_eventList.get(d).getTimestamp(), _eventList.get(_curid).getTimestamp()) >= 0) { // the pointer already moved to beyond the duration
                                curid[0] = d+1; // record position
                            }
                            break;
                        case "OR":
                            curid[0] = Math.min(curid[0], d+1); // record new position
                            break;
                        default:
                            curid[0] = Math.max(curid[0], d+1); // record new position
                            break;
                    }
                    _patientResult[1] = Math.min(d, _patientResult[1]); //record start event id
                    return true;
                }
            }
            if(_root.compareTo("DATE")) { // Absolute date, not add to cache, not sorted
                // binary search by date
                // update curid if exist as the last event
                long target = alternativeDateFormat2.parse((String)_root.getValue()[0]).getTime();
                curid[0] = binarySearch(_curid, _eventList, target);
                if (_eventList.get(curid[0]).getTimestamp() < target) return false;
                else {
                    _patientResult[3] = 1;
                    _patientResult[1] = Math.min(curid[0], _patientResult[1]); //record start event id
                    return true;
                }

            } else if (_root.compareTo("AGE")) { // Age (age in attribute)
                // DOB + value[0]/value[1], date of the other child should fall into this interval
                // update curid as the last event
                long date = (long)_patientInfo.get("DOB");
                long[] yearAtEvent = new long[] {calculateYear("Y", (int)_root.getValue()[0], date), _root.getValue().length>1? calculateYear("Y", (int)_root.getValue()[1], date): calculateYear("Y", (int)_root.getValue()[0], date)};

                // check if the event of other child is in cache, get the list of timestamp directly
                ArrayList<Integer> eventid = _par.left.getData().equals(_root.getData())? _eventCache.get(_par.right.getEvent()) : _eventCache.get(_par.left.getEvent());
                if (eventid != null) {
                    for (int id : eventid) {
                        curid[0] = id+1;
                        if(Long.compare(_eventList.get(id).getTimestamp(), yearAtEvent[0]) >= 0 && Long.compare(_eventList.get(id).getTimestamp(), yearAtEvent[1]) <= 0) return true;
                    }
                }

                // find the event if not in cache, start from where stopped
                while (curid[0] < _eventList.size()) {
                    Event curEvent = _eventList.get(curid[0]);
                    // if the outcome event has been seen
                    if(curEvent.getType().compareTo(_outcomeEvent)==0) _patientResult[0] = 1;
                    // add event to cache
                    if(!_eventCache.containsKey(curEvent.getType())) {
                        _eventCache.put(curEvent.getType(), new ArrayList<Integer>());
                    }
                    int cacheSize=_eventCache.get(curEvent.getType()).size();
                    if(cacheSize==0 || _eventCache.get(curEvent.getType()).get(cacheSize-1)<curid[0]){
                        _eventCache.get(curEvent.getType()).add(curid[0]);
                    }
                    // only if within the interval
                    DataType code = _par.left.getData().equals(_root.getData())? _par.right.getEvent() : _par.left.getEvent();
                    if (curEvent.getType().compareTo(code) == 0 && Long.compare(curEvent.getTimestamp(), yearAtEvent[0]) >= 0 && Long.compare(curEvent.getTimestamp(), yearAtEvent[1]) <= 0) {
                        curid[0]++;
                        _patientResult[1] = Math.min(curid[0]-1, _patientResult[1]); //record start event id
                        return true;
                    }
                    curid[0]++;
                }
                return false;
            } else { //normal search from where it is stopped in the cache
                if (_par.compareTo("THEN_WITHIN")) {
                    // Check date exceeded the duration already
                    if ( curid[0] < _eventList.size() && Long.compare(_eventList.get(curid[0]).getTimestamp(), _eventList.get(_curid).getTimestamp()) > (int)_par.getValue()[0]*86400000L) return false;
                }

                // check if the event exist
                while (curid[0] < _eventList.size()) {
                    Event curEvent = _eventList.get(curid[0]);
                    // if the outcome event has been seen
                    if(curEvent.getType().compareTo(_outcomeEvent)==0) _patientResult[0] = 1;
                    // add event to cache
                    if(!_eventCache.containsKey(curEvent.getType())) {
                        _eventCache.put(curEvent.getType(), new ArrayList<Integer>());
                    }
                    int cacheSize=_eventCache.get(curEvent.getType()).size();
                    if(cacheSize==0 || _eventCache.get(curEvent.getType()).get(cacheSize-1)<curid[0]){
                        _eventCache.get(curEvent.getType()).add(curid[0]);
                    }

                    // if it is THEN_WITHIN, check bound
                    if (_par.compareTo("THEN_WITHIN") && Long.compare(curEvent.getTimestamp(), _eventList.get(_curid).getTimestamp()) > (int)_par.getValue()[0]*86400000L) return false;

                    // if the event found, update curid as the last event seen
                    if (curEvent.getType().compareTo(_root.getEvent()) == 0) {
                        curid[0]++;
                        _patientResult[1] = Math.min(curid[0]-1, _patientResult[1]); //record start event id
                        return true;
                    }
                    curid[0]++;
                }
                return false;
            }
        }
        boolean leftResult = queryTreeTraversal(_patientInfo, _eventList, _root.left, _root, _eventCache, _curid, curid, _patientResult, _outcomeEvent);
        boolean rightResult = true; //default is true, unless found false

        if(_root.compareTo("THEN") || _root.compareTo("THEN_WITHIN")) { // No duration or Within, start searching from curid
            _curid = curid[0]; // Update curid, search from there next round
        } else if (_root.compareTo("THEN_BEYOND")) { // Beyond the duration
            // check if no event before the duration at all, update curid
            long dateFound = _eventList.get(curid[0]-1).getTimestamp();
            while (curid[0] < _eventList.size()) {
                Event curEvent = _eventList.get(curid[0]);
                // if the outcome event has been seen
                if(curEvent.getType().compareTo(_outcomeEvent)==0) _patientResult[0] = 1;
                // add event to cache
                if(!_eventCache.containsKey(curEvent.getType())) {
                    _eventCache.put(curEvent.getType(), new ArrayList<Integer>());
                }
                int cacheSize=_eventCache.get(curEvent.getType()).size();
                if(cacheSize==0 || _eventCache.get(curEvent.getType()).get(cacheSize-1)<curid[0]){
                    _eventCache.get(curEvent.getType()).add(curid[0]);
                }
                if (curEvent.getTimestamp() >= dateFound+(int)_root.getValue()[0]*86400000L) break;
                curid[0]++;
            }
            _curid = curid[0]; // Update curid, search from there next round
            if(curid[0] >= _eventList.size()) {
                return false;
            }
        }
        // Not execute if left result is true when OR, skip when a child is "age" since it is already determined
        if(((!_root.left.compareTo("AGE")) && (!_root.right.compareTo("AGE"))) && (!_root.compareTo("OR") || !leftResult)) {
            rightResult = queryTreeTraversal(_patientInfo, _eventList, _root.right, _root, _eventCache, _curid, curid, _patientResult, _outcomeEvent);
        }
        _patientResult[2] = Math.max(curid[0]-1, _patientResult[2]); //record end event id
        return (_root.compareTo("OR"))? leftResult || rightResult : leftResult && rightResult;
    }

    // search the id of event by date
    private int binarySearch(int _curid, ArrayList<Event> _eventList, long _date) {
        int l = _curid;
        int r = _eventList.size()-1;
        while (l<r) {
            int m = l+(r-l)/2;
            if (Long.compare(_eventList.get(m).getTimestamp(), _date) < 0) {
                l = m+1;
            } else if (Long.compare(_eventList.get(m).getTimestamp(), _date) > 0) {
                r = m;
            } else {
                return m;
            }
        }
        return r;
    }

    // search event id in event cache
    private int binarySearch2(ArrayList<Integer> _list, int _target) {
        int l = 0;
        int r = _list.size()-1;
        while(l<r) {
            int m = l+(r-l)/2;
            if(_list.get(m)<_target) {
                l = m+1;
            } else if(_list.get(m)>_target) {
                r = m;
            } else {
                return m;
            }
        }
        return r;
    }

    // calculate date after some years or some days
    private long calculateYear(String _format, int _add, long _date) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(_date);
        switch (_format) {
            case "Y":
                cal.add(Calendar.YEAR, _add);
                break;
            case "D":
                cal.add(Calendar.DATE, _add);
                break;
        }
        return cal.getTimeInMillis();
    }

    public long getPatSizeByDataType(DataType _type) {return this.dataTypePatCounter.get(_type).size();}

    public long getTotalEvents() {return this.totalEvents;}

    private List<DataType> getDataTypeList() {return this.dataTypeList;}
*/
    private HashMap<String,HashMap<String,Object>> parseAttributes(String attributes_filename) {
        HashMap<String,HashMap<String,Object>> attribute_map = new HashMap<>();

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
                HashMap<String,Object> entity_attributes = attribute_map.get(_id);
                if (entity_attributes == null) {
                    entity_attributes = new HashMap<>();
                    attribute_map.put(_id, entity_attributes);
                }

                // Store the data in the map for this id.
                entity_attributes.put(_var, convertValueToType(_val, _type));
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
    private HashMap<String, ArrayList<Event>> parseEvents(String events_filename) {
        HashMap<String,ArrayList<Event>> data_map = new HashMap<>();

        // Next read in the events file.
        try {
            CSVParser input_parser = CSVParser.parse(new File(events_filename), StandardCharsets.UTF_8, CSVFormat.RFC4180.withHeader());

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String _id = _item.get("id");
                Date _date = dateFormat.parse(_item.get("date"));
                String code_class = _item.get("codeclass");
                String _code = _item.get("code");

                // Is this a new ID?  If so, create an entry in the data map.
                if (!data_map.containsKey(_id)) {
                    data_map.put(_id, new ArrayList<>());
                }
                data_map.get(_id).add(new Event(DataType.getDataType(code_class, _code,"", null), _date.getTime()));

                // Increment patient counter by DataType
                dataTypePatCounter.computeIfAbsent(DataType.getDataType(code_class, _code, "", null), k -> new HashSet<>()).add(_id);
                totalEvents++;
            }
        } catch (IOException|ParseException e) {
            e.printStackTrace();
        }

        return data_map;
    }

    /**
     * Loads the event dictionary, creating a new DataType object for each type of event in the dictionary.
     * @param eventdict_filename The event dictionary CSV file
     */
    private ArrayList<DataType> parseEventDictionary(String eventdict_filename) {
        // Create an empty list to use to store the events as they are parsed.
        ArrayList<DataType> type_list = new ArrayList<>();

        // Read in the events file.
        try {
            CSVParser input_parser = CSVParser.parse(new File(eventdict_filename), StandardCharsets.UTF_8, CSVFormat.RFC4180.withHeader());

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String code_class = _item.get("codeclass");
                String _code = _item.get("code");
                String _label = _item.get("label");

                // Instantiate an DataType.  We don't use it here, but by instantiating it with a label, we can re-use
                // the event type object (with the label) whenever we need it while parsing the event data file (which
                // doesn't contain event type labels).
                type_list.add(DataType.getDataType(code_class, _code, _label, null));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        return type_list;
    }

    @Override
    public void teardown() {
        this.attributeData.clear();
        this.eventData.clear();
        this.dataTypeList.clear();
    }
}
