package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

/**
 * Created by gotz on 6/15/16.
 */
public abstract class GenericType implements JSONSerializable {

    /**
     * Returns a new ConstructedType that combines the current type with the supplied _type, combined with AND.
     * @param _type
     * @return
     */
    public abstract ConstructedType and(GenericType _type);

    /**
     * Returns a new ConstructedType that combines the current type with the supplied _type, combined with OR.
     * @param _type
     * @return
     */
    public abstract ConstructedType or(GenericType _type);

    /**
     * Returns a new ConstructedType that combines the current type with the supplied _type, combined with THEN.
     * @param _type
     * @return
     */
    public abstract ConstructedType then(GenericType _type);

    public abstract JSONObject toJSON() throws JSONException;
}
