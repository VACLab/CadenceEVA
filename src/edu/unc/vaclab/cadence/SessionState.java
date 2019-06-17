package edu.unc.vaclab.cadence;

import edu.unc.vaclab.cadence.data.CohortTree;
import edu.unc.vaclab.cadence.data.DataSet;

/**
 * Created by gotz on 6/1/17.
 */
public class SessionState {
    public static String SESSION_STATE_KEY = "session_state";

    private ApplicationState applicationState;
    private DataSet sessionDataSet;
    private CohortTree cohortTree;

    public SessionState(ApplicationState app_state) {
        applicationState = app_state;
    }

    public ApplicationState getApplicationState() {
        return applicationState;
    }

    public void setDataSet(DataSet _ds) {
        this.sessionDataSet = _ds;
    }

    public DataSet getDataSet() {
        return this.sessionDataSet;
    }

    public void setCohortTree(CohortTree cohort_tree){
        cohortTree = cohort_tree;
    }

    public CohortTree getCohortTree(){
        return this.cohortTree;
    }
}
