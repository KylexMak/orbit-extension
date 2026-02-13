import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Event } from '../lib/scheduleUtils';

export function useOrbitEvents() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .neq('status', 'skipped')
            .gte('start_time', new Date().toISOString());

        if (!error && data) {
            setEvents(data as unknown as Event[]);
        }
        setLoading(false);
    };

    const addEvent = async (
        title: string, 
        start: Date, 
        end: Date, 
        description?: string,
        googleCalendarId?: string,
        itemType?: 'event' | 'task'
    ) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const eventData: Record<string, string> = {
            user_id: user.id,
            title,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'pending'
        };

        if (description) {
            eventData.description = description;
        }

        if (googleCalendarId) {
            eventData.google_calendar_id = googleCalendarId;
        }

        if (itemType) {
            eventData.type = itemType;
        }

        const { error } = await supabase.from('events').insert(eventData);

        if (!error) fetchEvents();
    };

    const updateEvent = async (
        event: Event, 
        newStart: Date, 
        newEnd: Date,
        newTitle?: string,
        newDescription?: string
    ) => {
        const updateData: Record<string, string> = {
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            status: 'pending'
        };

        if (newTitle) {
            updateData.title = newTitle;
        }

        if (newDescription !== undefined) {
            updateData.description = newDescription;
        }

        const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', event.id);

        if (!error) fetchEvents();
    };

    const skipEvent = async (event: Event, newStart: Date, newEnd: Date) => {
        await updateEvent(event, newStart, newEnd);
    };

    const deleteEvent = async (eventId: string | number) => {
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', eventId);

        if (!error) fetchEvents();
    };

    useEffect(() => {
        fetchEvents();

        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'events',
                },
                () => {
                    fetchEvents();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { events, loading, addEvent, updateEvent, skipEvent, deleteEvent, fetchEvents };
}
