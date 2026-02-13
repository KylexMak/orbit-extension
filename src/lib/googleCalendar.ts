
export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
    htmlLink: string;
}

export interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    due?: string;
    status: 'needsAction' | 'completed';
}

export const getUpcomingEvents = async (providerToken: string): Promise<CalendarEvent[]> => {
    try {
        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' +
            new Date().toISOString() +
            '&maxResults=10&singleEvents=true&orderBy=startTime',
            {
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch calendar events');
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        throw error;
    }
};

export const getTasks = async (providerToken: string): Promise<GoogleTask[]> => {
    try {
        // First, get the task lists
        const listsResponse = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                },
            }
        );

        if (!listsResponse.ok) {
            const errorData = await listsResponse.json();
            throw new Error(errorData.error?.message || 'Failed to fetch task lists');
        }

        const listsData = await listsResponse.json();
        const taskLists = listsData.items || [];

        if (taskLists.length === 0) {
            return [];
        }

        // Get tasks from the first task list (primary)
        const primaryList = taskLists[0];
        const tasksResponse = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${primaryList.id}/tasks?showCompleted=false`,
            {
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                },
            }
        );

        if (!tasksResponse.ok) {
            const errorData = await tasksResponse.json();
            throw new Error(errorData.error?.message || 'Failed to fetch tasks');
        }

        const tasksData = await tasksResponse.json();
        return tasksData.items || [];
    } catch (error) {
        console.error('Error fetching Google Tasks:', error);
        return [];
    }
};

export const createEvent = async (
    providerToken: string, 
    title: string, 
    start: Date, 
    end: Date, 
    description?: string
): Promise<CalendarEvent | null> => {
    try {
        const event = {
            summary: title,
            description: description || '',
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
        };

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to create calendar event');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating calendar event:', error);
        throw error;
    }
};

export const updateEvent = async (
    providerToken: string,
    eventId: string,
    title: string,
    start: Date,
    end: Date,
    description?: string
): Promise<CalendarEvent | null> => {
    try {
        const event = {
            summary: title,
            description: description || '',
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
        };

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to update calendar event');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating calendar event:', error);
        throw error;
    }
};

export const deleteEvent = async (
    providerToken: string,
    eventId: string
): Promise<boolean> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${providerToken}`,
                },
            }
        );

        if (!response.ok && response.status !== 204) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to delete calendar event');
        }

        return true;
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        throw error;
    }
};

// Function to automatically insert "Time to Eat and Breathe" slots
export const insertWellnessBreaks = async (
    providerToken: string,
    events: CalendarEvent[]
): Promise<CalendarEvent[]> => {
    const createdBreaks: CalendarEvent[] = [];

    try {
        // Sort events by start time
        const sortedEvents = [...events].sort((a, b) => {
            const aTime = new Date(a.start.dateTime || a.start.date || '').getTime();
            const bTime = new Date(b.start.dateTime || b.start.date || '').getTime();
            return aTime - bTime;
        });

        for (let i = 0; i < sortedEvents.length - 1; i++) {
            const currentEvent = sortedEvents[i];
            const nextEvent = sortedEvents[i + 1];

            const currentEnd = new Date(currentEvent.end.dateTime || currentEvent.end.date || '');
            const nextStart = new Date(nextEvent.start.dateTime || nextEvent.start.date || '');

            // Calculate gap in minutes
            const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

            // If gap is at least 30 minutes, insert a wellness break
            if (gapMinutes >= 30) {
                const breakDuration = Math.min(gapMinutes, 60); // Max 60 minute break
                const breakEnd = new Date(currentEnd.getTime() + breakDuration * 60 * 1000);

                const breakEvent = await createEvent(
                    providerToken,
                    '🌿 Time to Eat and Breathe',
                    currentEnd,
                    breakEnd,
                    'A wellness break to recharge. Take time to eat, breathe, and relax.'
                );

                if (breakEvent) {
                    createdBreaks.push(breakEvent);
                }
            }
        }
    } catch (error) {
        console.error('Error inserting wellness breaks:', error);
    }

    return createdBreaks;
};
