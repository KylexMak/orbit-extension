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

    const addEvent = async (title: string, start: Date, end: Date) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('events').insert({
            user_id: user.id,
            title,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'pending'
        });

        if (!error) fetchEvents();
    };

    const skipEvent = async (event: Event, newStart: Date, newEnd: Date) => {
        const { error } = await supabase
            .from('events')
            .update({
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString(),
                status: 'pending'
            })
            .eq('id', event.id);

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

    return { events, loading, addEvent, skipEvent, fetchEvents };
}
