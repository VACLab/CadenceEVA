package edu.unc.vaclab.cadence.data;

import edu.unc.vaclab.cadence.data.connectors.CadenceDataConnector;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;

import java.util.List;

/**
 * Created by gotz on 11/15/16.
 */
public class DataSet {
    private String id;
    private String name;
    private String dir;
    private String connectorClassname;
    private List<String> eventClasses;
    private CadenceDataConnector connector;
    private Vocabulary vocabulary;
    private boolean isConnected;

    public DataSet(String _id, String _name, String _dir, String _connector, Vocabulary _vocab, List<String> event_classes, List<Cohort> _cohorts, List<Query> _queries) {
        id = _id;
        name = _name;
        dir = _dir;
        connectorClassname = _connector;
        isConnected = false;
        vocabulary = _vocab;
        eventClasses = event_classes;
    }

    public String getID() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDir() {
        return dir;
    }

    public List<String> getEventClasses() {
        return eventClasses;
    }

    /**
     * Returns the number of entities in the dataset.
     * @return The number of entities, or null if the dataset is not connected.
     */
    public Long getSize() {
        return isConnected ? connector.getSize() : null;
    }

    public boolean connect() {

        // Create and initialize the connector for this dataset.
        if (!isConnected) {
            // Instantiate the specified connector and initialize.
            try {
                connector = (CadenceDataConnector) Class.forName(connectorClassname).newInstance();
                connector.init(this.dir, this.vocabulary, this.eventClasses);
                isConnected = true;
            } catch (ClassNotFoundException | IllegalAccessException | InstantiationException _e) {
                if (connector != null) {
                    connector.teardown();
                    connector = null;
                }
                isConnected = false;
            }
        }

        return isConnected;
    }

    public Vocabulary getVocabulary() {
        return vocabulary;
    }

    public CadenceDataConnector getConnector() {return isConnected ? connector : null;}
}

