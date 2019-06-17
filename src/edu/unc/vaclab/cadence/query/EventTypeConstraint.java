package edu.unc.vaclab.cadence.query;

import edu.unc.vaclab.cadence.data.DataType;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

public class EventTypeConstraint extends Constraint {

    private DataType eventType;

    public EventTypeConstraint(DataType event_type) {
        eventType = event_type;
    }

    public DataType getDataType() {
        return eventType;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();

        _json.put("type", eventType.toJSON());
        return _json;
    }

    public Constraint deepCopy() {
        EventTypeConstraint _copy = new EventTypeConstraint(this.eventType);
        return _copy;
    }

    public String toString() {
        return eventType.toString();
    }
}
