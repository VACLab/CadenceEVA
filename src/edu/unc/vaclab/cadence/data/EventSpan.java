package edu.unc.vaclab.cadence.data;

public class EventSpan {
    private int startIndex;
    private int endIndex;

    // A "soft span" is one where the start index can be used to find the next matching event in a query. For example,
    // a specific date constraint, where the next constraint may still match with the first event in the span.  In
    // contrast, a "hard span" is one where the start index is "already used up" because it matched a constraint.  For
    // example, if the first event in the span was a matching ICD code for a specific EventTypeConstraint, it can't be
    // used to match the next event constraint.
    private boolean softSpan;

    // The start span index should be included, where as the end span index should be excluded.  Therefore, a span from
    // 0->4 should include indices (0,1,2,3). The exception is a soft span.  Soft spans will include NEITHER the start
    // or end.  Typically start=end for a soft span.
    public EventSpan(int _start, int _end, boolean soft_span) {
        startIndex = _start;
        endIndex = _end;
        softSpan = soft_span;
    }

    public int size() {
        return endIndex - startIndex;
    }

    public int getStart() {
        return startIndex;
    }

    public int getEnd() {
        return endIndex;
    }

    public void setStart(int _start) {
        startIndex = _start;
    }

    public void setEnd(int _end) {
        endIndex = _end;
    }

    public boolean isSoftSpan() {
        return softSpan;
    }
}
