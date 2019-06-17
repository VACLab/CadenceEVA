package edu.unc.vaclab.cadence;

import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.connectors.CSVWithOHDSIVocabDataConnector;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;

public class TestDriver {

    public static void main(String[] args)  {
        // Update status.
        System.out.println("Starting!");
        System.out.flush();

        // Load the data by setting up a Data Connector.
        CSVWithOHDSIVocabDataConnector data = new CSVWithOHDSIVocabDataConnector();

        // Update status.
        System.out.println("Connecting to vocabulary server.");
        System.out.flush();
        Vocabulary _vocab = new Vocabulary("jdbc:postgresql://sils-gotz.ad.unc.edu:8032/omop", "vaclabuser", "vaclab206", "web/cfg/ICD10_chapters.csv");
        _vocab.init();
        _vocab.connect();


        // Update status.
        System.out.println("Vocab ready, time to load data.");
        printCurrentDateTime();
        System.out.flush();
        data.init("/Volumes/Gotz_David_IRB15-2043/Run2/DATA/data_test", _vocab, null);
        String[] _classes = {"ICD10CM", "CPT4"};
        //data.init("/Volumes/Gotz_David_IRB15-2043/Run2/DATA/data_hf", _vocab, new ArrayList(Arrays.asList(_classes)));

        // Define a hard coded query.
        // A query with attributes, and a date that would include a patient.
        //String query_json = "{\"query\":{\"type\":\"THEN\",\"left\":{\"cat\":\"Specific Date\",\"code\":\"2010-05-21T04:00:00.000Z\"},\"right\":{\"type\":\"THEN_WITHIN\",\"left\":{\"cat\":\"ICD10CM\",\"code\":\"B37\"},\"right\":{\"cat\":\"ICD10CM\",\"code\":\"B34\"},\"val\":\"3650\"}},\"attribute\":{\"type\":\"THEN\",\"left\":{\"varname\":\"age\",\"value\":25,\"datatype\":\"int\",\"relation\":\"gt\"},\"right\":{\"varname\":\"gender\",\"value\":\"F\",\"datatype\":\"string\",\"relation\":\"eq\"}},\"outcome\":{\"cat\":\"ICD10CM\",\"code\":\"D12\"}}\n";

        // A query with no attributes:
        // String query_json = "{\"query\":{\"type\":\"THEN\",\"left\":{\"cat\":\"ICD10CM\",\"code\":\"M54\"},\"right\":{\"cat\":\"ICD10CM\",\"code\":\"B35\"}},\"outcome\":{\"cat\":\"ICD10CM\",\"code\":\"D13\"}}";

        // A query that starts with a time constraint (relation with left=null).
        //String query_json = "{\"query\":{\"type\":\"THEN_BEYOND\",\"right\":{\"cat\":\"ICD10CM\",\"code\":\"B35\"},\"val\":\"1000\"},\"outcome\":{\"cat\":\"ICD10CM\",\"code\":\"B34\"}}";

        // A query that starts and ends with a time constraint.
        // String query_json = "{\"query\":{\"type\":\"THEN_BEYOND\",\"right\":{\"type\":\"THEN_WITHIN\",\"left\":{\"cat\":\"ICD10CM\",\"code\":\"B35\"},\"val\":\"13\"},\"val\":\"200\"},\"outcome\":{\"cat\":\"ICD10CM\",\"code\":\"B34\"}}";

        // A query that starts and ends with a time constraint, and includes an outcome with a time gap.
        String query_json = "{\"query\":{\"type\":\"THEN_EQUAL\",\"right\":{\"type\":\"THEN_EQUAL\",\"left\":{\"cat\":\"ICD10CM\",\"code\":\"D50\"},\"val\":\"0\"},\"val\":\"500\"},\"outcome\":{\"type\":\"THEN_BEYOND\",\"right\":{\"cat\":\"ICD10CM\",\"code\":\"I49\"},\"val\":\"50\"}}";

        // Parse into a query object.
        try {
            // Update status.
            System.out.println("Data has loaded. Starting on JSON.");
            printCurrentDateTime();
            System.out.flush();

            JSONObject json_obj = new JSONObject(query_json);
            Query query_obj = new Query(json_obj, _vocab);

            // Update status.
            System.out.println("Done parsing query JSON.");
            System.out.flush();

            // Execute the query.
            printCurrentDateTime();
            Cohort _cohort = data.query(query_obj);

            // Display the size.
            System.out.println("Retrieved " + _cohort.getEntities().size() + " patients");
            printCurrentDateTime();
            System.out.flush();

            // Print out the included span of events for the first matching entities.
            for (String _id : _cohort.getEntities().keySet()) {
                System.out.println("ENTITY ID: " + _id);
                System.out.println("\toutcome: " + _cohort.getOutcomes().get(_id));
                Entity _entity = _cohort.getEntities().get(_id);
                EventSpan _span = _cohort.getSpans().get(_id);
                for (int i=_span.getStart(); i<=_span.getEnd(); i++) {
                    System.out.println("\tevent " + i + ": " + _entity.getEventList().get(i));
                }
            }

        }
        catch(JSONException e) {
            System.out.println(e);
        }
    }

    public static void printCurrentDateTime() {
        SimpleDateFormat date_format = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
        System.out.println(date_format.format(new Date()));
    }
}
