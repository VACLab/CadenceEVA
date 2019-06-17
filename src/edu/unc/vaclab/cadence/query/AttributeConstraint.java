package edu.unc.vaclab.cadence.query;

import edu.unc.vaclab.cadence.data.DataType;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.Comparator;

public class AttributeConstraint<T> extends Constraint {

    private DataType attributeType;
    private T attributeValue;
    private Comparator<T> comparator;
    private AttributeOperator operator;

    public enum AttributeOperator {
        LESS_THAN, GREATER_THAN, EQUAL, NOT_EQUAL
    }

    public AttributeConstraint(DataType attribute_type, AttributeOperator _operator, T attribute_value, Comparator<T> _comparator) {
        attributeType = attribute_type;
        attributeValue = attribute_value;
        operator = _operator;
        comparator = _comparator;
    }

    public boolean test(T test_value) {
        int compare_val = comparator.compare(test_value, attributeValue);

        switch (operator) {
            case EQUAL:
                return compare_val == 0;
            case LESS_THAN:
                return compare_val < 0;
            case GREATER_THAN:
                return compare_val > 0;
            default:
                return false;
        }
    }

    public DataType getAttributeType() {
        return attributeType;
    }

    public String getAttributeValue() {
        return getAttributeValue();
    }

    @Override
    public JSONObject toJSON() throws JSONException {
        JSONObject _json = new JSONObject();
        _json.put("type", attributeType.toJSON());
        _json.put("value", attributeValue);
        _json.put("op", operator);
        return _json;
    }

    public Constraint deepCopy() {

        AttributeConstraint<T> _copy = new AttributeConstraint<T>(
            this.attributeType,
            this.operator,
            this.attributeValue,
            this.comparator
        );

        return _copy;
    }

}
