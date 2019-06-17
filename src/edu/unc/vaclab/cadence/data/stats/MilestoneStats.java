package edu.unc.vaclab.cadence.data.stats;

import edu.unc.vaclab.cadence.data.Entity;
import edu.unc.vaclab.cadence.data.Event;
import edu.unc.vaclab.cadence.data.EventSpan;
import edu.unc.vaclab.cadence.data.timeline.Milestone;
import edu.unc.vaclab.cadence.data.timeline.Timeline;
import edu.unc.vaclab.cadence.data.timeline.VirtualMilestone;

import java.util.List;
import java.util.Map;

public class MilestoneStats extends TimelineStats {

    Milestone milestone;

    public MilestoneStats(Timeline _timeline, Milestone _milestone, Map<String, EventSpan> _spans) {
        super(_timeline, _spans);
        milestone = _milestone;
    }

    @Override
    protected double determineDurationForEntity(Entity _entity, EventSpan _span) {
        // The duration for a Milestone should return the difference between the first and last events that make up the
        // span for this milestone.
        List<Event> event_list = _entity.getEventList();

        if (this.milestone instanceof VirtualMilestone) {
            return 0;
        }

        if (_span.getStart() >= event_list.size()) {
            System.out.println("=====================");
            System.out.println("ABOUT TO NPE!");
            System.out.println("=====================");
            System.out.flush();
        }

        long start_time = event_list.get(_span.getStart()).getTimestamp();
        long end_time = event_list.get(_span.getEnd()-1).getTimestamp();
        return (double)(end_time - start_time);
    }
}

