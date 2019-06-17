package edu.unc.vaclab.cadence.query;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.Date;

public class DateConstraint extends Constraint {

    private Date dateValue;

    // If the date appears at the start or middle of the query, we treat it as a min bound (we want all things on or
    // after the date).  If, however, it is a terminal constraint at the end of a query, we want to treat it as a max
    // bound (we want all things on or before the date).   This has an impact on the events returned by a query.  We'll
    // have to look at this value when executing the query.
    private boolean isTerminal;

    public DateConstraint(Date date_value, boolean is_terminal) {
        dateValue = date_value;
        isTerminal = is_terminal;
    }

    public Date getDateValue() {
        return dateValue;
    }

    public boolean isTerminal() {
        return isTerminal;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        _json.put("date", dateValue.toString());
        return _json;
    }

    public Constraint deepCopy() {
        DateConstraint _copy = new DateConstraint(this.dateValue, this.isTerminal);
        return _copy;
    }
}
