package edu.unc.vaclab.cadence.query;

import edu.unc.vaclab.cadence.data.AttributedDataType;
import edu.unc.vaclab.cadence.data.DataType;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;

public class Query implements Cloneable {
    protected SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    private Constraint temporalConstraints;
    private Constraint attributeConstraints;
    private Constraint outcomeConstraints;

    // Constructor
    public Query(JSONObject json_query_def, Vocabulary _vocab) {
        // Convert the JSON objects to a formal query.string to JSONObjects
        try {
            // Map the JSON objects to a query object.  Check for missing values to avoid crashing.
            if (json_query_def.has("outcome")) {
                JSONObject outcome_constraints = json_query_def.getJSONObject("outcome");
                outcomeConstraints = mapToConstraints(outcome_constraints, _vocab);
            }
            if (json_query_def.has("attribute")) {
                JSONObject attribute_constraints = json_query_def.getJSONObject("attribute");
                attributeConstraints = mapToConstraints(attribute_constraints, _vocab);
            }
            if (json_query_def.has("query")) {
                JSONObject query_constraints = json_query_def.getJSONObject("query");
                // Mark the "last" constraint in the query with the "terminal" attribute. We need this to successfully
                // execute the query.
                markTerminalConstraint(query_constraints);
                temporalConstraints = mapToConstraints(query_constraints, _vocab);
            }
        }
        catch (JSONException e) {
            System.err.println("JSON error in Query::Query.");
            return;
        }
    }

    // Constructor which clones the provided query.
    public Query(Query query_to_clone) {
        if (query_to_clone.getTemporalConstraints() == null)
            temporalConstraints = null;
        else
            temporalConstraints = query_to_clone.getTemporalConstraints().deepCopy();

        if (query_to_clone.getAttributeConstraints() == null)
            attributeConstraints = null;
        else
            attributeConstraints = query_to_clone.getAttributeConstraints().deepCopy();

        if (query_to_clone.getOutcomeConstraints() == null)
            outcomeConstraints = null;
        else
            outcomeConstraints = query_to_clone.getOutcomeConstraints().deepCopy();
    }

    public void addToAttributeConstraints(AttributedDataType _type, AttributeConstraint.AttributeOperator attr_op, Comparator _comparator, Object _value) {
        AttributeConstraint new_constraint = new AttributeConstraint(_type, attr_op, _value, _comparator) ;
        if (attributeConstraints == null) {
            attributeConstraints = new_constraint;
        }
        else {
            attributeConstraints = new RelationConstraint(this.attributeConstraints, RelationConstraint.RelationType.THEN, null, new_constraint);
        }
    }

    private void markTerminalConstraint(JSONObject _constraint) throws JSONException {
        if (_constraint.has("right")) {
            markTerminalConstraint(_constraint.getJSONObject("right"));
        }
        else {
            _constraint.put("terminal", true);
        }
    }

    public void replaceTimeConstraintsFromTimeline(Timeline _timeline) {
        this.temporalConstraints = _timeline.toQueryConstraints();
    }

    // Recursively maps the json object to Java Constraints (or more accurately, subclasses of Constraint).
    private Constraint mapToConstraints(JSONObject json_obj, Vocabulary _vocab) throws JSONException {
        // Create the variable that will eventually be returned.
        Constraint _constraint = null;

        // Get the constraint type and branch based on the type of constraint we need to create.

        if (!json_obj.has("type")) {
            // There is no type, so this is an attribute or event constraint.

            // Does it have a category?  If so, it's an event.
            if (json_obj.has("cat")) {
                // Is the cat equal to a known category, such as Specific Date?
                String _cat = json_obj.getString("cat");
                String _code = json_obj.getString("code");
                if (_cat.equals("Specific Date")) {
                    // The 'code' value is actually the date.  It must be parsed.
                    try {
                        _constraint = new DateConstraint(dateFormat.parse(_code), json_obj.has("terminal"));
                    }
                    catch (ParseException _e) {
                        System.err.println(_e);
                    }
                }

                // If not a known category, it must be a category from the vocabulary (and Event Type)
                else {
                    // Get the code to go with the category, using it to retrieve the
                    // corresponding data type, and use that to create the constraint object.

                    DataType _type = DataType.getDataType(_cat, _code);
                    if (_type == null) {
                        _vocab.connect();
                        _type = _vocab.getEventType(_cat, _code);
                        _vocab.disconnect();
                    }
                    _constraint = new EventTypeConstraint(_type);
                }
            }
            else {
                // This must be an attribute constraint.
                String _varname = json_obj.getString("varname");
                String _value = json_obj.getString("value");
                String data_type = json_obj.getString("datatype");

                // Get the corresponding attributed data type.
                AttributedDataType attr_data_type = _vocab.getAttributedDataType("ATTRIBUTE", _varname, data_type, null);

                if (data_type.equals("string")) {
                    _constraint = new AttributeConstraint<String>(attr_data_type, AttributeConstraint.AttributeOperator.EQUAL, _value, Comparator.naturalOrder());
                }
                else {
                    String relation_str = json_obj.getString("relation");
                    AttributeConstraint.AttributeOperator _op = AttributeConstraint.AttributeOperator.EQUAL;
                    if (relation_str.equals("lt")) {
                        _op = AttributeConstraint.AttributeOperator.LESS_THAN;
                    }
                    if (relation_str.equals("gt")) {
                        _op = AttributeConstraint.AttributeOperator.GREATER_THAN;
                    }
                    _constraint = new AttributeConstraint<>(attr_data_type, _op, Integer.parseInt(_value), Comparator.naturalOrder());
                }
            }
        }
        else {
            String _type = json_obj.getString("type");
            // There is a type... Let's do the right thing based on that type.
            if (_type.equals("THEN")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = null;
                Constraint constraint_right = null;
                if (json_obj.has("left"))
                    constraint_left = mapToConstraints(json_obj.getJSONObject("left"), _vocab);
                if (json_obj.has("right"))
                    constraint_right = mapToConstraints(json_obj.getJSONObject("right"), _vocab);
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.THEN, null, constraint_right);
            }
            else if (_type.equals("THEN_BEYOND")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = null;
                Constraint constraint_right = null;
                if (json_obj.has("left"))
                    constraint_left = mapToConstraints(json_obj.getJSONObject("left"), _vocab);
                if (json_obj.has("right"))
                    constraint_right = mapToConstraints(json_obj.getJSONObject("right"), _vocab);
                Duration _duration = Duration.ofDays(Long.parseLong(json_obj.getString("val")));
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.THEN_BEYOND, _duration, constraint_right);
            }
            else if (_type.equals("THEN_WITHIN")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = null;
                Constraint constraint_right = null;
                if (json_obj.has("left"))
                    constraint_left = mapToConstraints(json_obj.getJSONObject("left"), _vocab);
                if (json_obj.has("right"))
                    constraint_right = mapToConstraints(json_obj.getJSONObject("right"), _vocab);
                Duration _duration = Duration.ofDays(Long.parseLong(json_obj.getString("val")));
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.THEN_WITHIN, _duration, constraint_right);
            }
            else if (_type.equals("THEN_EQUAL")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = null;
                Constraint constraint_right = null;
                if (json_obj.has("left"))
                    constraint_left = mapToConstraints(json_obj.getJSONObject("left"), _vocab);
                if (json_obj.has("right"))
                    constraint_right = mapToConstraints(json_obj.getJSONObject("right"), _vocab);
                Duration _duration = Duration.ofDays(Long.parseLong(json_obj.getString("val")));
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.THEN_EQUAL, _duration, constraint_right);
            }

            /* OR/AND are not yet supported....
            else if (_type.equals("OR")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = mapToConstraints(json_obj.getJSONObject("left"));
                Constraint constraint_right = mapToConstraints(json_obj.getJSONObject("right"));
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.OR, null, constraint_right);
            }
            else if (_type.equals("AND")) {
                // This is a binary relation.  Get the two sub-constraints, then build the relation.
                Constraint constraint_left = mapToConstraints(json_obj.getJSONObject("left"));
                Constraint constraint_right = mapToConstraints(json_obj.getJSONObject("right"));
                _constraint = new RelationConstraint(constraint_left, RelationConstraint.RelationType.AND, null, constraint_right);
            }*/
        }

        return _constraint;
    }

    public Constraint getTemporalConstraints() {
        return temporalConstraints;
    }

    public Constraint getOutcomeConstraints() {
        return outcomeConstraints;
    }

    public Constraint getAttributeConstraints() { return attributeConstraints; }

    public Set<DataType> getSetOfEventConstraintDataTypes() {
        return getSetOfEventConstraintDataTypesHelper(temporalConstraints);
    }

    public Set<DataType> getSetOfAttributeConstraintDataTypes() {
        return getSetOfAttributeConstraintDataTypesHelper(attributeConstraints);
    }

    // Helper function containing recursive implementation of getSetOfEventConstraintDataTypes()
    private Set<DataType> getSetOfEventConstraintDataTypesHelper(Constraint _constraint) {
        if (_constraint instanceof EventTypeConstraint) {
            HashSet<DataType> data_type_set = new HashSet<>();

            data_type_set.add(((EventTypeConstraint) _constraint).getDataType());

            return data_type_set;
        }
        else if (_constraint instanceof RelationConstraint) {
            // This is a relationship constraint.  Let's recursively find sets of data types from both
            // constraints A and B, then return the union of these sets.
            Set<DataType> data_type_set = getSetOfEventConstraintDataTypesHelper(((RelationConstraint)_constraint).constraintA);
            data_type_set.addAll(getSetOfEventConstraintDataTypesHelper(((RelationConstraint)_constraint).constraintB));
            return data_type_set;
        }
        else {
            // We ignore DateConstraint objects in this portion of the code.  Just return an empty set.
            return new HashSet<>();
        }
    }

    // Helper function containing recursive implementation of getSetOfAttributeConstraintDataTypes()
    private Set<DataType> getSetOfAttributeConstraintDataTypesHelper(Constraint _constraint) {
        if (_constraint instanceof AttributeConstraint) {
            HashSet<DataType> data_type_set = new HashSet<>();

            data_type_set.add(((AttributeConstraint) _constraint).getAttributeType());

            return data_type_set;
        }
        else if (_constraint instanceof RelationConstraint) {
            // This is a relationship constraint.  Let's recursively find sets of data types from both
            // constraints A and B, then return the union of these sets.
            Set<DataType> data_type_set = getSetOfEventConstraintDataTypesHelper(((RelationConstraint)_constraint).constraintA);
            data_type_set.addAll(getSetOfEventConstraintDataTypesHelper(((RelationConstraint)_constraint).constraintB));
            return data_type_set;
        }
        else {
            // We ignore DateConstraint objects in this portion of the code.  Just return an empty set.
            return new HashSet<>();
        }
    }
}


