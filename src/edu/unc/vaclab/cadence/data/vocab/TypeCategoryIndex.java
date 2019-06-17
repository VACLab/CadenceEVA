package edu.unc.vaclab.cadence.data.vocab;

import edu.unc.vaclab.cadence.data.DataType;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;

/**
 * Created by gotz on 12/20/17.
 */
public class TypeCategoryIndex implements Serializable {
    protected HashMap<String,List<DataType>> codes_by_parent = new HashMap<>();
    protected HashMap<String,DataType> codes_by_code = new HashMap<>();

    // Adds the given type to the index.  This consists of putting the type into a
    // variety of hashmap lookup tables.
    protected void add_to_index(DataType _type) {
        codes_by_code.put(_type.getCode(), _type);

        // Get the parent code.  We use null as the key if there is no parent (a root data type).
        String parent_code = _type.getParent() == null ? null : _type.getParent().getCode();
        codes_by_parent.putIfAbsent(parent_code, new ArrayList<>());
        codes_by_parent.get(parent_code).add(_type);
    }

    public Collection<DataType> getAllDataTypes() {
        return codes_by_code.values();
    }
}
