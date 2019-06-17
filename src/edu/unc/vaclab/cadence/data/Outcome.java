package edu.unc.vaclab.cadence.data;

public class Outcome {

    private float value;
    private Long timeToOutcome;

    /**
     * Constructor
     * @param _value The outcome value.
     * @param time_to_outcome The time relative to the end of the episode to this outcome. Null if not applicable.
     */
    public Outcome(float _value, Long time_to_outcome) {
        value = _value;
        timeToOutcome = time_to_outcome;
    }

    public float getValue() {
        return value;
    }
    public Long getTimeToOutcome() {
        return timeToOutcome;
    }
}
