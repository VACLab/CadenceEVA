package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

public class DataType extends GenericType implements Serializable {

    private static int NEXT_ID = 0;
    private synchronized static int generateID() {
        return NEXT_ID++;
    }

    protected final int id;
	protected final String category;
    protected final String code;
	protected final String label;
    protected final DataType parent;

	protected static Map<String, Map<String,DataType>> dataTypeMap = new HashMap<>();

	protected DataType(String code_category, String _code, String _label, DataType _parent) {
	    id = generateID();
        category = code_category;
        code = _code;
        label = _label;
        parent = _parent;
	}

    public static void addToIndex(DataType _type) {
        Map<String,DataType> category_map  = dataTypeMap.computeIfAbsent(_type.getCategory(), k -> new HashMap<>() );
        category_map.put(_type.getCode(), _type);
    };

    public static DataType getDataType(String code_category, String _code, String _label, DataType _parent){
        // Look up the code category, creating a new map if this is the first time the code category has been seen.
        Map<String,DataType> category_map  = dataTypeMap.computeIfAbsent(code_category, k -> new HashMap<>() );

        // Look up the code, creating a new DataType if this is the first time the code has been seen.
        return category_map.computeIfAbsent(_code, k -> new DataType(code_category, _code, _label, _parent) );
    }

    public static DataType getDataType(String code_category, String _code){
        // Look up the code category, returning null if not found.
        Map<String,DataType> category_map  = dataTypeMap.get(code_category);
        if (category_map == null) {
            return null;
        }
        else {
            // Look up the code, returning null if not found.
            return category_map.get(_code);
        }
    }

    public int getID() {
        return id;
    }

	public String getCode() {
        return code;
   }

	public String getCategory() {
		return category;
	}

	public String getLabel() {
		return label;
	}

	public DataType getParent() {
	    return parent;
    }

    public boolean isEqualToOrChildOf(DataType equality_type) {
        if (this == equality_type) {
            return true;
        }
        else {
            // Check to see if the parent type is equal or a child of the equality type.
            if (this.getParent() == null) {
                return false;
            } else {
                return this.getParent().isEqualToOrChildOf(equality_type);
            }
        }
    }

    public int compareTo(DataType o) {
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

    @Override
    public ConstructedType and(GenericType _type) {
        return new ConstructedType(this, ConstructedType.RelationType.AND, _type);
    }

    @Override
    public ConstructedType or(GenericType _type) {
        return new ConstructedType(this, ConstructedType.RelationType.OR, _type);
    }

    @Override
    public ConstructedType then(GenericType _type) {
        return new ConstructedType(this, ConstructedType.RelationType.THEN, _type);
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject json_obj = new JSONObject();
        json_obj.put("id", this.id);
        json_obj.put("cat", this.category);
        json_obj.put("code", this.code);
        json_obj.put("label", this.label);
        return json_obj;
    }

    @Override
    public String toString() {
	    return "[" + this.category + " " + this.code + " / " + this.label + "]";
    }
}


