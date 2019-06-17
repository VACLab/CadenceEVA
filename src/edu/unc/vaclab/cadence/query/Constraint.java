package edu.unc.vaclab.cadence.query;

import edu.unc.vaclab.cadence.data.JSONSerializable;

public abstract class Constraint implements JSONSerializable {

    public abstract Constraint deepCopy();
}
