package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

public interface JSONSerializable {

	JSONObject toJSON() throws JSONException;
	
}
