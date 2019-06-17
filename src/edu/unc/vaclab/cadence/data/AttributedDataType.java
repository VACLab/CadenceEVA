package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;

public class AttributedDataType extends DataType implements Serializable {

    protected final String valueType;
    protected final TreeSet<String> valueDomain;

	public static DataType getDataType(String code_category, String _code, String _label, DataType _parent, String value_type, TreeSet<String> value_domain) {
	    // Look up the code category, creating a new map if this is the first time the code category has been seen.
        Map<String,DataType> category_map  = DataType.dataTypeMap.computeIfAbsent(code_category, k -> new HashMap<>() );

        // Look up the code, creating a new DataType if this is the first time the code has been seen.
        return category_map.computeIfAbsent(_code, k -> new AttributedDataType(code_category, _code, _label, _parent, value_type, value_domain) );
	}

    public static DataType getDataType(String code_category, String _code){
        // Look up the code category, returning null if not found.
        Map<String,DataType> category_map  = DataType.dataTypeMap.get(code_category);
        if (category_map == null) {
            return null;
        }
        else {
            // Look up the code, returning null if not found.
            return category_map.get(_code);
        }
    }

	private AttributedDataType(String code_category, String _code, String _label, DataType _parent, String value_type, TreeSet<String> value_domain) {
        super(code_category, _code, _label, _parent);
        this.valueType = value_type;
        this.valueDomain = value_domain;
	}

    public int compareTo(AttributedDataType o) {
		// Compare first by code category.
        int category_comparison = this.category.compareTo(o.category);
        if (category_comparison != 0) {
        	// If categories are not equal, return that comparison result.
            return category_comparison;
        }
        else {
        	// If categories are indeed equal, then we need to compare by code.
            return this.code.compareTo(o.code);
        }
    }

    public TreeSet<String> getValueDomain() {
	    return this.valueDomain;
    }

    public String getValueType() {
	    return this.valueType;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject json_obj = new JSONObject();
        json_obj.put("cat", this.category);
        json_obj.put("code", this.code);
        json_obj.put("label", this.label);
        json_obj.put("type", this.valueType);
        json_obj.put("domain", this.valueDomain);
        return json_obj;
    }

    @Override
    public String toString() {
	    return "[" + this.category + " " + this.code + " / " + this.label + " / " + this.valueType + " / " + this.valueDomain + "]";
    }
}


