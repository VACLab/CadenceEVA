package edu.unc.vaclab.cadence.data.stats;

import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.Event;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.timeline.Milestone;
import edu.unc.vaclab.cadence.data.timeline.Pathway;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import edu.unc.vaclab.cadence.data.timeline.VirtualMilestone;

import java.util.List;
import java.util.Map;

public class PathwayStats extends TimelineStats {

    private Pathway pathway;

    public PathwayStats(Timeline _timeline, Pathway _pathway, Map<String, EventSpan> _spans) {
        super(_timeline, _spans);

        pathway = _pathway;
    }

    @Override
    protected double determineDurationForEntity(Entity _entity, EventSpan _span) {
        // The duration for a pathway should return the difference the end of the start milestone, and the start of the
        // end milestone.
        List<Event> event_list = _entity.getEventList();
        long start_time = 0;
        long end_time = 0;

        // If the pathway starts with a virtual milestone, we need to compute the right time.
        Milestone _src = pathway.getSource();
        if (_src instanceof VirtualMilestone) {
            // The time of the span is determined by the virtual milestone.
            start_time = ((VirtualMilestone)_src).getVirtualTimestamps().get(_entity.getID());
        }
        else {
            EventSpan src_span = _src.getSpans().get(_entity.getID());
            start_time = event_list.get(src_span.getEnd() - 1).getTimestamp();
        }

        // Now check the destination milestone.
        Milestone _dest = pathway.getDestination();
        if (_dest instanceof VirtualMilestone) {
            // The time of the span is determined by the virtual milestone.
            end_time = ((VirtualMilestone)_dest).getVirtualTimestamps().get(_entity.getID());
        }
        else {
            EventSpan dest_span = pathway.getDestination().getSpans().get(_entity.getID());
            end_time = event_list.get(dest_span.getStart()).getTimestamp();
        }

        long time_delta = end_time - start_time;
        double delta_as_double = (double)time_delta;
        return delta_as_double;
    }
}
