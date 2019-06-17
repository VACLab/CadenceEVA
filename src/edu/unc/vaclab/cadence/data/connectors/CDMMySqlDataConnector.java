package edu.unc.vaclab.cadence.data.connectors;

import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;

import java.util.List;

/**
 * Created by gotz on 6/5/17.
 *
 * TODO: This class is just a stub.  We must implement the code to query against the common data model in a MySQL db.
 */
public class CDMMySqlDataConnector extends CadenceDataConnector {

    /**
     * Constructor
     */
    public CDMMySqlDataConnector() {
    }

    @Override
    public void init(String _directory, Vocabulary _vocab, List<String> event_classes) {
    }

    @Override
    public long getSize() {
        // TODO: Get size capabilities must be implemented.
        return 0;
    }

    @Override
    public Cohort query(Query _query) {
        // TODO: Query capabilities must be implemented.
        return null;
    }

    @Override
    public void teardown() {
    }
}
