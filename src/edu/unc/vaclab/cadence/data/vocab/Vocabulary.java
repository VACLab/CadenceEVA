package edu.unc.vaclab.cadence.data.vocab;

import edu.unc.vaclab.cadence.data.AttributedDataType;
import edu.unc.vaclab.cadence.data.DataType;
import edu.unc.vaclab.cadence.data.vocab.icd10.ICDBlock;
import javafx.util.Pair;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.sql.*;
import java.util.*;

/**
 * Created by gotz on 12/18/17.
 */
public class Vocabulary {

    private HashMap<String,TypeCategoryIndex> typeIndices = new HashMap<>();
    private TypeCategoryIndex attributeIndex = new TypeCategoryIndex();

    private ICDBlock icdMetaHierarchy = null;

    /**
     * The database connection to the vocabulary db server.
     */
    private Connection vocabularyDB;

    private String dbUrl;
    private String username;
    private String password;
    private Properties dbProps;
    private boolean hasChanged;
    /**
     * Constructor
     *
     * @param db_url The JDBC URL of the OMOP database
     * @param _username The username for connecting to the database
     * @param _password The password for connecting to the database
     */
    public Vocabulary(String db_url, String _username, String _password, String icd10MetaHierarchyFile) {
        hasChanged = false;
        dbUrl = db_url;
        username = _username;
        password = _password;
        icdMetaHierarchy = ICDBlock.parseRangeFile(icd10MetaHierarchyFile);

        // Properties will be set in the init method, since it can generate exceptions.
        dbProps = null;
    }

    /**
     * Initializes the vocabulary dictionary by connecting to an OMOP database.
     *
     * @return True on success, false on failure.
     */
    public boolean init() {
        try {
            Class.forName("org.postgresql.Driver");

            // Configure the database properties object, getting ready to make connections to the vocabulary database.
            dbProps = new Properties();
            dbProps.setProperty("user", username);
            dbProps.setProperty("password", password);
            dbProps.setProperty("loginTimeout", "2");
        }
        catch (ClassNotFoundException e) {
            System.err.println(e);
            return false;
        }

        return true;
    }

    public boolean connect() {
        try {
            vocabularyDB = DriverManager.getConnection(dbUrl, dbProps);
        }
        catch (SQLException e) {
            System.err.println(e);
            return false;
        }
        return true;
    }

    /**
     * @return True if the vocabulary database has a live connection. False otherwise.
     */
    public boolean isConnected() {
        return this.vocabularyDB != null;
    }

    /**
     * Clean up the vocabulary object by closing the database connection.
     * @return True on success, false on failure.
     */
    public boolean disconnect() {
        if (vocabularyDB != null) {
            try {
                vocabularyDB.close();
                vocabularyDB = null;
            }
            catch (SQLException e) {
                System.err.println(e);
                return false;
            }
        }
        return true;
    }

    private String capitalize(String _input) {
        return _input.substring(0, 1).toUpperCase() + _input.substring(1);
    }

    /**
     * Returns the requested data type, returning an existing matching data type or creating a new data type if needed.
     * @param _class
     * @param _code
     * @return
     */
    public AttributedDataType getAttributedDataType(String _class, String _code, String value_type, TreeSet<String> value_domain) {
        // Is the event type already defined?
        AttributedDataType _type = (AttributedDataType)this.attributeIndex.codes_by_code.get(_code);
        if (_type == null) {
            // Create a new type
            _type = (AttributedDataType) AttributedDataType.getDataType(_class, _code, capitalize(_code), null, value_type, value_domain);
            // Index the new type.
            this.attributeIndex.add_to_index(_type);
        }

        // Finally, return the result.
        return _type;
    }

    public DataType getEventType(String _class, String _code) {
        // Is the event type already defined?
        TypeCategoryIndex type_index = this.typeIndices.get(_class);
        if (type_index != null) {
            DataType _type = type_index.codes_by_code.get(_code);
            if (_type != null) {
                return _type;
            }
        }
        else {
            // The index for this class of event type has not been defined.  This means (1) that this is a new event
            // type, and (2) that this event class is also new.  Create a new index for this class of event type.
            this.typeIndices.put(_class, new TypeCategoryIndex());
        }

        //////////////////////////////
        // If the code reaches this point, then the type was not found.  We need to create it!
        //////////////////////////////
        hasChanged = true;

        System.out.println("MISSED VOCAB LOCKUP; QUERYING TO VOCAB DB.");
        System.out.flush();

        // Create a variable to store the result that will be returned at the end of the method.
        DataType _result = null;

        // Look up the event type in the DB, getting all predecessors. This must be "special cased" for ICD10 or 9,
        // since the OHDSI vocabulary treats these as "non-standard":
        // http://www.ohdsi.org/web/wiki/doku.php?id=documentation:vocabulary:icd10cm
        if (_class.equals("ICD10CM") || _class.equals("ICD9CM")) {
            String _sql = "select c1.concept_code c1code, c1.concept_name c1name, c2.concept_code c2code, c2.concept_name c2name " +
                    "from (concept c1 join concept_relationship cr on c1.concept_id = cr.concept_id_1) " +
                    "join concept c2 on cr.concept_id_2 = c2.concept_id " +
                    "where cr.relationship_id='Is a' and c1.concept_code = '"+_code+"' and c2.vocabulary_id='"+_class+"' " +
                    "order by c2.concept_class_id";
            try {
                // Execute the query.
                Statement _stmt = vocabularyDB.createStatement();
                ResultSet _results = _stmt.executeQuery(_sql);

                // Get the type index which will index the new types we are about to instantiate.
                type_index = this.typeIndices.get(_class);

                // Ensure that the root type is present (not in the database).  Then add event types one at a time.
                boolean low_level_type_created = false;
                DataType _type = this.createAndReturnEventType(type_index, _class, "ROOT", _class + " ROOT", null);

                // Before getting to the codes from the database, we must first ensure the ICD10 meta hierarchy codes are present.
                // This is only needed for ICD10 codes.
                if (_class.equals("ICD10CM")) {
                    List<ICDBlock> meta_parents = icdMetaHierarchy.getParentChain(_code);

                    // Create and return types for all of these meta-parents.
                    for (ICDBlock _block : meta_parents) {
                        System.out.println(_block);
                        _type = this.createAndReturnEventType(type_index, _class, _block.getStart()+"-"+_block.getEnd(), _block.getLabel(),  _type);
                    }
                }

                while (_results.next()) {
                    _type = this.createAndReturnEventType(type_index, _class, _results.getString("c2code"), _results.getString("c2name"), _type);
                    if (_results.isLast()) {
                        _type = this.createAndReturnEventType(type_index, _class, _results.getString("c1code"), _results.getString("c1name"), _type);
                        low_level_type_created = true;
                    }
                }
                // Check that the lowest level type is inserted.  It will NOT be inserted via the logic above if the type has no parents in the vocabulary server.
                if (!low_level_type_created) {
                    // In this case we have to manually query for the even type label without relying on relationships in the database.
                    _sql = "select c1.concept_code c1code, c1.concept_name c1name from concept c1 where " +
                            "c1.concept_code = '"+_code+"' and c1.vocabulary_id='"+_class+"'";
                    _results = _stmt.executeQuery(_sql);
                    while (_results.next()) {
                        _type = this.createAndReturnEventType(type_index, _class, _results.getString("c1code"), _results.getString("c1name"), _type);
                        low_level_type_created = true;
                    }
                }

                // Reeturn null if the event type code not be resolved in the db.
                if (low_level_type_created == false) {
                    System.out.println("NOT IN DB: " + _code + " " + _class);
                    return null;
                }

                // Store the final type result to return at the end of the method.
                _result = _type;
            }
            catch (SQLException e) {
                System.err.println(e);
                _result = null;
            }
        }
        else {
            // Standard concepts can be directly looked up in the concept relationship table one ancestor at a time.

            // Start by looking up each code's parent until there are no more parents.
            ArrayList<Pair> code_list_to_root =  new ArrayList<>();
            String current_code = _code;
            String current_label = null;
            while (current_code != null) {
                // Define SQL required to lookup parent.
                String _sql = "select c1.concept_code c1code, c1.concept_name c1name, c2.concept_code c2code, c2.concept_name c2name " +
                        "from (concept c1 join concept_relationship cr on c1.concept_id = cr.concept_id_1) " +
                        "join concept c2 on cr.concept_id_2 = c2.concept_id " +
                        "where cr.relationship_id='Is a' and c1.concept_code = '"+current_code+"' and c2.vocabulary_id='"+_class+"' " +
                        "order by c2.concept_class_id";

                // Execute the query
                try {
                    Statement _stmt = vocabularyDB.createStatement();
                    ResultSet _results = _stmt.executeQuery(_sql);
                    if (_results.next()) {
                        // Store the current code
                        if (current_label == null) {
                            current_label = _results.getString("c1name");
                        }
                        code_list_to_root.add(0, new Pair(current_code, current_label));

                        // Update the current* variables to point to the next parent
                        current_code = _results.getString("c2code");
                        current_label = _results.getString("c2name");
                    }
                    else {
                        current_code = null;
                        current_label = null;
                    }
                }
                catch (SQLException e) {
                    System.err.println(e);
                    current_code = null;
                    current_label = null;
                }
            }

            // Next, create new data types for each code type in the list.

            // First, get the type index which will index the new types we are about to instantiate.
            type_index = this.typeIndices.get(_class);

            // Add event types one at a time. We start by ensuring that there is a root event type for this class.
            DataType _type = this.createAndReturnEventType(type_index, _class, "ROOT", _class + " ROOT", null);

            Iterator<Pair> code_iter = code_list_to_root.iterator();
            while (code_iter.hasNext()) {
                Pair next_code = code_iter.next();
                _type = this.createAndReturnEventType(type_index, _class, (String)next_code.getKey(), (String)next_code.getValue(), _type);
            }

            // Store the final type result to return at the end of the method.
            _result = _type;
        }

        // Return the result.
        return _result;
    }

    private DataType createAndReturnEventType(TypeCategoryIndex type_index, String _class, String _code, String _desc, DataType _parent) {
        // Does the type already exist?  If so, return it. If not, we have work to do.
        DataType _type = type_index.codes_by_code.get(_code);
        if (_type == null) {
            // Type doesn't exist. Let's create it.
            _type = DataType.getDataType(_class, _code, _desc, (_parent==null?null:_parent));

            // Index it.
            type_index.add_to_index(_type);
        }
        return _type;
    }

    public List<DataType> getRootTypes() {
        ArrayList<DataType> result_list = new ArrayList<>();

        Iterator<TypeCategoryIndex> _iter = this.typeIndices.values().iterator();
        while (_iter.hasNext()) {
            // The root has a parent of null in the hierarchy.  And there should
            // only be one such root for each category.
            result_list.add(_iter.next().codes_by_parent.get(null).get(0));
        }

        return result_list;
    }

    public List<AttributedDataType> getAttributeTypes() {
        ArrayList<AttributedDataType> result_list = new ArrayList<>();

        Iterator<DataType> _iter = this.attributeIndex.codes_by_code.values().iterator();
        while (_iter.hasNext()) {
            // The root has a parent of null in the hierarchy.  And there should
            // only be one such root for each category.
            result_list.add((AttributedDataType)_iter.next());
        }

        return result_list;
    }

    // Gets a list of data types that are "descendants" in the data type hierarchy.  Does not include the supplied data
    // type.
    public List<DataType> getAllDescendants(DataType root_data_type) {
        ArrayList<DataType> all_children = new ArrayList<>();
        LinkedList<DataType> type_queue = new LinkedList<>();

        // Create a queue of data types which must be looked up to find descendants.  Populate it initially with the
        // children for the root data type given as a parameter for this lookup.
        List<DataType> _children = getChildren(root_data_type.getCategory(), root_data_type.getCode());
        if (_children != null) {
            all_children.addAll(_children);
            type_queue.addAll(_children);
        }

        // Now enter a loop, looking up children of those children until the type_queue is empty.
        while (!type_queue.isEmpty()) {
            DataType next_type = type_queue.pop();
            _children = getChildren(next_type.getCategory(), next_type.getCode());
            if (_children != null) {
                all_children.addAll(_children);
                type_queue.addAll(_children);
            }
        }

        return all_children;
    }

    public List<DataType> getChildren(String parent_cat, String parent_code) {
        TypeCategoryIndex _index = this.typeIndices.get(parent_cat);
        if (_index != null) {
            return _index.codes_by_parent.get(parent_code);
        }

        // If lookup fails, return null.
        return null;
    }

    /**
     * Checks to see if the given data type is a leaf node (no children) in the hierarchy.
     * @param _type The type to check.
     * @return True if the type is a leaf, false if it is a parent.
     */
    public boolean isLeaf(DataType _type) {
        // The data type is a leaf if the code is not present in the codes_by_parent index.
        return (null == this.typeIndices.get(_type.getCategory()).codes_by_parent.get(_type.getCode()));
    }

    public void serializeToFile(String _filename) {
        try {
            FileOutputStream _fos = new FileOutputStream(_filename);
            ObjectOutputStream _oos = new ObjectOutputStream(_fos);
            _oos.writeObject(this.typeIndices);
            _fos.close();
            _oos.close();
        }
        catch (Exception e) {
            System.err.println(e);
        }
    }

    public boolean deserializeFromFile(String _filename) {
        try {
            FileInputStream _fis = new FileInputStream(_filename);
            ObjectInputStream _ois = new ObjectInputStream(_fis);
            this.typeIndices = (HashMap<String, TypeCategoryIndex>) _ois.readObject();

            // Iterate over the indices, adding all deserilized data types to the DataType dataTypeMap.
            Iterator<TypeCategoryIndex> _iter = typeIndices.values().iterator();
            while (_iter.hasNext()) {
                TypeCategoryIndex category_index = _iter.next();
                Iterator<DataType> type_iter = category_index.getAllDataTypes().iterator();
                while (type_iter.hasNext()) {
                    DataType.addToIndex(type_iter.next());
                }
            }
            return true;
        }
        catch(Exception e) {
            System.err.println(e);
            return false;
        }
    }

    public boolean hasChanged() {
        return hasChanged;
    }

    public int getEventTypeCount() {
        int _count = 0;
        for (TypeCategoryIndex _index : this.typeIndices.values()) {
            _count += _index.codes_by_code.size();
        }
        return _count;
    }
}
