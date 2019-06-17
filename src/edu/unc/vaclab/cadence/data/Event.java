package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.io.Serializable;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * A timestamped event of a given type.
 */
public class Event implements JSONSerializable, Serializable {
	private DataType type;

	// The time of the event, in ms.
	private long timestamp;

	public Event(DataType _type, long _timestamp) {
		type = _type;
		timestamp = _timestamp;
	}

	public DataType getType() {
		return type;
	}

	public long getTimestamp() {
		return timestamp;
	}

    /**
     * Events are considered equal if they have the same type and the same timestamp.
     * @param _obj
     * @return
     */
	public boolean equals(Object _obj) {
		if (_obj instanceof Event) {
			Event other_event = (Event)_obj;
			if (other_event.type.equals(this.type) && (other_event.timestamp == this.timestamp)) {
				return true;
			}
			else {
				return false;
			}
		}
		else {
			return false;
		}
	}

	public boolean before(long other_timestamp) {
		return timestamp < other_timestamp;
	}

	public boolean after(long other_timestamp) {
		return timestamp > other_timestamp;
	}

    /**
     * Convert the event to a JSON object for serialization.
     * @return
     * @throws JSONException
     */
	public JSONObject toJSON() throws JSONException {
		JSONObject json_obj = new JSONObject();
		json_obj.put("type", this.getType().toJSON());
		json_obj.put("timestamp", this.getTimestamp());
		DateFormat _format = new SimpleDateFormat("MM/dd/yyyy HH:mm:ss");
		json_obj.put("date", _format.format(new Date(this.getTimestamp())));
		return json_obj;
	}

	public String toString() {
		try {
			return this.toJSON().toString();
		}
		catch (Exception e) {
			return "JSONError";
		}
	}
}

