package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;

import static edu.unc.vaclab.cadence.data.ConstructedType.RelationType.*;
import static edu.unc.vaclab.cadence.data.ConstructedType.RelationType.THEN_BEYOND;

/**
 * Created by gotz on 8/30/17.
 */
public class ConstructedType extends GenericType {

    private static final String TYPE_CLASS = "CONSTRUCTED";
    private static double CODE_GENERATOR = 0;

    protected GenericType typeA;
    protected GenericType typeB;
    protected RelationType relationship;
    protected Duration timeConstraint;
    protected String code;

    private static HashMap<String, ConstructedType> typeMap = new HashMap<>();

    public static ConstructedType getConstructedType(String _category, String _code) {
        return typeMap.get(_code);
    }

    protected ConstructedType(GenericType type_a, RelationType _relationship, Duration time_constraint, GenericType type_b) {
        typeA = type_a;
        relationship = _relationship;
        timeConstraint = time_constraint;
        typeB = type_b;
        code = String.valueOf(CODE_GENERATOR++);
        typeMap.put(code, this);
    }

    protected ConstructedType(GenericType type_a, RelationType _relationship, GenericType type_b) {
        this(type_a, _relationship, null, type_b);
    }

    public enum RelationType {
        AND, OR, THEN, THEN_WITHIN, THEN_BEYOND,;
        public static final HashSet<String> RELATIONS;
        static {
            RELATIONS = new HashSet<>();
            for(RelationType r : RelationType.values()) {
                RELATIONS.add(r.name());
            }
        }
    }

    @Override
    public ConstructedType and(GenericType _type) {
        return new ConstructedType(this, AND, _type);
    }

    @Override
    public ConstructedType or(GenericType _type) {
        return new ConstructedType(this, OR, _type);
    }

    @Override
    public ConstructedType then(GenericType _type) {
        return new ConstructedType(this, THEN, _type);
    }

    public ConstructedType within(Duration time_constraint) {
        this.relationship = THEN_WITHIN;
        this.timeConstraint = time_constraint;
        return this;
    }

    public ConstructedType beyond(Duration time_constraint) {
        this.relationship = THEN_BEYOND;
        this.timeConstraint = time_constraint;
        return this;
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();
        _json.put("class", TYPE_CLASS);
        _json.put("code", this.code);
        _json.put("typeA", typeA.toJSON());
        _json.put("relationship", relationship.toString());
        if (timeConstraint != null)
            _json.put("duration", String.valueOf(timeConstraint.toDays()));
        _json.put("typeB", typeB.toJSON());
        return _json;
    }
}

