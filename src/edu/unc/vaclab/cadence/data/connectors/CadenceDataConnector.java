package edu.unc.vaclab.cadence.data.connectors;

import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.query.Query;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.List;

/**
 * Created by gotz on 6/5/17.
 */
public abstract class CadenceDataConnector {
    protected SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    protected SimpleDateFormat alternativeDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm");

    public abstract void init(String _directory, Vocabulary _vocab, List<String> event_classes);
    public abstract void teardown();
    public abstract long getSize();
    public abstract Cohort query(Query _query);

    /**
     * Converts a string to the specified type.  Recognizes:
     * - int
     * - long
     * - float
     * - double
     * - boolean
     *
     * By deault (if type is not an exact match for one of the above types), string is returned.
     * @param _val
     * @param _type
     * @return
     */
    protected Object convertValueToType(String _val, String _type) {
        if (_type.equals("int")) {
            return Integer.valueOf(_val);
        }
        else if (_type.equals("long")) {
            return Long.valueOf(_val);
        }
        else if (_type.equals("float")) {
            return Float.valueOf(_val);
        }
        else if (_type.equals("double")) {
            return Double.valueOf(_val);
        }
        else if (_type.equals("boolean")) {
            return Boolean.valueOf(_val);
        }
        else if (_type.equals("date")) {
            long date = 0;
            try {
                date = dateFormat.parse(_val).getTime();
            } catch (ParseException e) {
                e.printStackTrace();
            }
            return date;
        }
        else {
            return _val;
        }
    }
}
