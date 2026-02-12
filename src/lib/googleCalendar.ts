
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
            throw new Error('Failed to fetch calendar events');
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
};

export const createEvent = async (providerToken: string, title: string, start: Date, end: Date): Promise<Event | null> => {
    try {
        const event = {
            summary: title,
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
        return null;
    }
};
