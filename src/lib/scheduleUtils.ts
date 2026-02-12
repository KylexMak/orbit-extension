import { addMinutes, differenceInMinutes, isAfter, isBefore } from 'date-fns';

export interface Event {
    id: string | number;
    user_id: string;
    title: string;
    start_time: string; // ISO string
    end_time: string;   // ISO string
    status: 'pending' | 'completed' | 'skipped';
    type?: 'event' | 'break'; // 'break' is virtual
}

export const injectSmartBreaks = (events: Event[]): Event[] => {
    const sortedEvents = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const eventsWithBreaks: Event[] = [];

    for (let i = 0; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];
        eventsWithBreaks.push(currentEvent);

        const nextEvent = sortedEvents[i + 1];

        // Check duration of current event
        const start = new Date(currentEvent.start_time);
        const end = new Date(currentEvent.end_time);
        const duration = differenceInMinutes(end, start);

        if (duration > 120) {
            // Long task > 2 hours -> Inject "Breathe" break inside?
            // For simplicity, we'll just append a break after it if there's space.
        }

        if (nextEvent) {
            const nextStart = new Date(nextEvent.start_time);
            const gap = differenceInMinutes(nextStart, end);

            if (gap >= 15) {
                eventsWithBreaks.push({
                    id: -Math.random(), // virtual ID
                    user_id: currentEvent.user_id,
                    title: gap >= 45 ? "Eat Something" : "Breathe & Stretch",
                    start_time: end.toISOString(),
                    end_time: nextStart.toISOString(),
                    status: 'pending',
                    type: 'break'
                });
            }
        }
    }

    return eventsWithBreaks;
};

export const calculateNextAvailableSlot = (
    durationMinutes: number,
    existingEvents: Event[],
    sleepStartStr: string,
    sleepEndStr: string
): { start: Date, end: Date } => {
    // Simple algorithm: Look for first gap starting from NOW + 10 mins Buffer
    let searchStart = addMinutes(new Date(), 10);

    // Sort events
    const sorted = [...existingEvents]
        .filter(e => isAfter(new Date(e.end_time), searchStart))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Check conflicts
    // This is a naive implementation.

    let candidate = searchStart;
    const maxSearch = addMinutes(candidate, 60 * 48); // limit search to 48 hours via minutes

    while (isBefore(candidate, maxSearch)) {
        const candidateEnd = addMinutes(candidate, durationMinutes);

        // Check collision with events
        const collidesWithEvent = sorted.some(e => {
            const eStart = new Date(e.start_time);
            const eEnd = new Date(e.end_time);
            return (isBefore(candidate, eEnd) && isAfter(candidateEnd, eStart));
        });

        const isSleeping = checkSleepCollision(candidate, sleepStartStr, sleepEndStr);

        if (!collidesWithEvent && !isSleeping) {
            return { start: candidate, end: candidateEnd };
        }

        candidate = addMinutes(candidate, 15);
    }

    return { start: searchStart, end: addMinutes(searchStart, durationMinutes) }; // Fallback
};

const checkSleepCollision = (start: Date, sleepStartStr: string, sleepEndStr: string) => {
    const startH = start.getHours();
    const sleepStartH = parseInt(sleepStartStr.split(':')[0]);
    const sleepEndH = parseInt(sleepEndStr.split(':')[0]);

    if (sleepStartH > sleepEndH) {
        return (startH >= sleepStartH || startH < sleepEndH);
    }
    else {
        return (startH >= sleepStartH && startH < sleepEndH);
    }
};
