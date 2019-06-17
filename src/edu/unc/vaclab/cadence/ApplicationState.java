package edu.unc.vaclab.cadence;

import edu.unc.vaclab.cadence.data.Cohort;
import edu.unc.vaclab.cadence.data.DataSet;
import edu.unc.vaclab.cadence.data.vocab.Vocabulary;
import edu.unc.vaclab.cadence.query.Query;
import org.apache.commons.configuration2.INIConfiguration;
import org.apache.commons.configuration2.SubnodeConfiguration;

import javax.servlet.ServletContext;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

/**
 * Created by gotz on 11/15/16.
 */
public class ApplicationState {
    public static String APPLICATION_STATE_KEY = "application_state";

    private static ApplicationState instance = null;

    private static ArrayList<DataSet> datasets = null;

    private ApplicationState(ServletContext _context) {

        String home_dir = "";
        if (_context != null) {
            home_dir = _context.getRealPath(".") + "/";
        }
        else {
            home_dir = "";
        }

        // Load the project configuration file.
        INIConfiguration _config = new INIConfiguration();
        try {
            FileReader cfg_file = new FileReader(home_dir + "cfg/cadence.cfg");
            _config.read(cfg_file);
        }
        catch (Exception _e) {
            System.err.println("Error reading Cadence configuration file.");
        }

        // Construct the dataset objects.
        datasets = new ArrayList<>();
        String[] dataset_ids = _config.getSection("globals").getString("datasets").split(",");
        for (int i=0; i<dataset_ids.length; i++) {
            // Get the corresponding section of the configuration file
            String _id = dataset_ids[i];
            SubnodeConfiguration _section = _config.getSection(_id);

            // Get dataset metadata
            String _name = _section.getString("name");
            String _dir = _section.getString("dir");
            String _connector = _section.getString("connector");
            String _classes = _section.getString("classes");
            List<String> event_classes = null;
            if (_classes != null) {
                event_classes = Arrays.asList(_classes.split(","));
            }

            // Initialize the vocabulary dictionary for this dataset.
            SubnodeConfiguration vocab_section = _config.getSection("vocabulary");
            Vocabulary _vocabulary = new Vocabulary(
                    vocab_section.getString("db_url"),
                    vocab_section.getString("username"),
                    vocab_section.getString("password"),
                    home_dir + "cfg/ICD10_chapters.csv"
            );
            _vocabulary.init();

            // Initialize a cohort list
            // XXX: Currently not being used
            List<Cohort> _cohorts = new ArrayList<Cohort>();

            // Initialize a query list
            // XXX: Currently not being used
            List<Query> _queries = new ArrayList<>();

            DataSet _dataset = new DataSet(_id, _name, _dir, _connector, _vocabulary, event_classes, _cohorts, _queries);
            datasets.add(_dataset);
        }
    }

    public List<DataSet> getDatasets() {
        return this.datasets;
    }

    public DataSet getDataset(String _id) {
        Iterator<DataSet> _iter = this.datasets.iterator();
        while (_iter.hasNext()) {
            DataSet _ds = _iter.next();
            if (_ds.getID().equals(_id)) {
                return _ds;
            }
        }
        return null;
    }

    public static ApplicationState getInstance(ServletContext _context) {
        if (instance == null) {
            instance = new ApplicationState(_context);
        }
        return instance;
    }
}
