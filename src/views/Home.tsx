import React, { useState, useEffect } from 'react';
import { useOrbitEvents } from '../hooks/useOrbitEvents';
import { injectSmartBreaks, calculateNextAvailableSlot, type Event } from '../lib/scheduleUtils';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, SkipForward, CheckCircle, Calendar, ListTodo, Clock } from 'lucide-react';
import { format, differenceInMinutes, addHours } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';

export const Home = () => {
    const { events, loading, addEvent, skipEvent } = useOrbitEvents();
    const [displayEvents, setDisplayEvents] = useState<Event[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [profile, setProfile] = useState<{ sleep_start: string, sleep_end: string } | null>(null);

    const [googleEvents, setGoogleEvents] = useState<Event[]>([]);
    const [googleTasks, setGoogleTasks] = useState<Event[]>([]);

    useEffect(() => {
        // Determine profile for sleep schedule
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setProfile(data);

                if (session.provider_token) {
                    await fetchGoogleData(session.provider_token, session.user.id);
                }
            }
        });
    }, []);

    const fetchGoogleData = async (providerToken: string, userId: string) => {
        try {
            const { getUpcomingEvents, getTasks } = await import('../lib/googleCalendar');
            
            // Fetch calendar events
            const gEvents = await getUpcomingEvents(providerToken);
            const mappedEvents: Event[] = gEvents.map(ge => ({
                id: ge.id,
                user_id: userId,
                title: `📅 ${ge.summary}`,
                description: ge.description,
                start_time: ge.start.dateTime || ge.start.date || new Date().toISOString(),
                end_time: ge.end.dateTime || ge.end.date || new Date().toISOString(),
                type: 'event',
                status: 'pending',
                google_calendar_id: ge.id
            }));
            setGoogleEvents(mappedEvents);

            // Fetch tasks
            const gTasks = await getTasks(providerToken);
            const mappedTasks: Event[] = gTasks
                .filter(task => task.status === 'needsAction')
                .map(task => {
                    // If task has a due date, use it; otherwise schedule for 1 hour from now
                    const dueDate = task.due ? new Date(task.due) : addHours(new Date(), 1);
                    const endDate = addHours(dueDate, 1); // Assume 1 hour duration
                    
                    return {
                        id: `task-${task.id}`,
                        user_id: userId,
                        title: `✓ ${task.title}`,
                        description: task.notes,
                        start_time: dueDate.toISOString(),
                        end_time: endDate.toISOString(),
                        type: 'task',
                        status: 'pending',
                        google_task_id: task.id
                    };
                });
            setGoogleTasks(mappedTasks);
        } catch (err) {
            console.error('Error fetching Google data:', err);
        }
    };

    useEffect(() => {
        const allEvents = [...events, ...googleEvents, ...googleTasks].sort((a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        const withBreaks = injectSmartBreaks(allEvents);
        setDisplayEvents(withBreaks);
    }, [events, googleEvents, googleTasks]);

    const handleSkip = async (event: Event) => {
        if (!profile) return;
        const duration = differenceInMinutes(new Date(event.end_time), new Date(event.start_time));
        const { start, end } = calculateNextAvailableSlot(duration, events, profile.sleep_start, profile.sleep_end);

        // If it's a Google Calendar event, update it there too
        if (event.google_calendar_id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.provider_token) {
                try {
                    const { updateEvent: updateGoogleEvent } = await import('../lib/googleCalendar');
                    await updateGoogleEvent(
                        session.provider_token,
                        event.google_calendar_id,
                        event.title.replace('📅 ', ''),
                        start,
                        end,
                        event.description
                    );
                } catch (err) {
                    console.error('Failed to update Google Calendar event:', err);
                }
            }
        }

        skipEvent(event, start, end);
        alert(`No worries! We moved this to ${format(start, 'h:mm a')} so you can rest.`);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Parse times or use defaults
        const now = new Date();
        let start: Date;
        let end: Date;

        if (newStartTime) {
            const [hours, minutes] = newStartTime.split(':').map(Number);
            start = new Date(now);
            start.setHours(hours, minutes, 0, 0);
            
            // If start time is in the past today, schedule for tomorrow
            if (start < now) {
                start.setDate(start.getDate() + 1);
            }
        } else {
            start = now;
        }

        if (newEndTime) {
            const [hours, minutes] = newEndTime.split(':').map(Number);
            end = new Date(start);
            end.setHours(hours, minutes, 0, 0);
            
            // If end is before start, assume it's the next day
            if (end <= start) {
                end.setDate(end.getDate() + 1);
            }
        } else {
            end = addHours(start, 1);
        }

        // Add to local Supabase
        await addEvent(newTitle, start, end, newDescription || undefined);

        // Sync to Google Calendar if connected
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.provider_token) {
            try {
                const { createEvent } = await import('../lib/googleCalendar');
                const newEvent = await createEvent(
                    session.provider_token, 
                    newTitle, 
                    start, 
                    end, 
                    newDescription || undefined
                );

                if (newEvent) {
                    // Store the Google Calendar ID in Supabase for future updates
                    await addEvent(newTitle, start, end, newDescription || undefined, newEvent.id);
                    
                    // Refresh Google data
                    await fetchGoogleData(session.provider_token, session.user.id);
                }
            } catch (err) {
                console.error("Failed to sync to Google Calendar", err);
            }
        }

        setNewTitle('');
        setNewDescription('');
        setNewStartTime('');
        setNewEndTime('');
        setShowAddForm(false);
    };

    const handleInsertWellnessBreaks = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.provider_token) {
            alert('Please connect to Google Calendar first');
            return;
        }

        try {
            const { insertWellnessBreaks } = await import('../lib/googleCalendar');
            const { getUpcomingEvents } = await import('../lib/googleCalendar');
            
            const currentEvents = await getUpcomingEvents(session.provider_token);
            const createdBreaks = await insertWellnessBreaks(session.provider_token, currentEvents);
            
            if (createdBreaks.length > 0) {
                alert(`Added ${createdBreaks.length} wellness break(s) to your calendar!`);
                // Refresh the calendar
                await fetchGoogleData(session.provider_token, session.user.id);
            } else {
                alert('No suitable gaps found for wellness breaks.');
            }
        } catch (err) {
            console.error('Failed to insert wellness breaks:', err);
            alert('Failed to insert wellness breaks. Please try again.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-aurora-text">Your Rhythm</h2>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleInsertWellnessBreaks} title="Add wellness breaks">
                        🌿
                    </Button>
                    <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {showAddForm && (
                <Card className="animate-in fade-in slide-in-from-top-4">
                    <CardContent className="pt-4">
                        <form onSubmit={handleCreate} className="space-y-3">
                            <Input
                                placeholder="What needs doing?"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                required
                                autoFocus
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-aurora-muted mb-1 block">Start Time</label>
                                    <Input
                                        type="time"
                                        value={newStartTime}
                                        onChange={e => setNewStartTime(e.target.value)}
                                        placeholder="Now"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-aurora-muted mb-1 block">End Time</label>
                                    <Input
                                        type="time"
                                        value={newEndTime}
                                        onChange={e => setNewEndTime(e.target.value)}
                                        placeholder="+1 hour"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1">Add</Button>
                                <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-3">
                {displayEvents.length === 0 && !loading && (
                    <div className="text-center text-aurora-muted py-10 opacity-70">
                        <p>No tasks yet.</p>
                        <p className="text-sm">Enjoy the silence or add something new.</p>
                    </div>
                )}

                {displayEvents.map((event) => {
                    const isBreak = event.type === 'break';
                    const isTask = event.type === 'task';
                    const isGoogleEvent = !!event.google_calendar_id;
                    
                    return (
                        <div
                            key={event.id}
                            className={`relative p-4 rounded-xl border transition-all ${isBreak
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-white border-gray-200 text-aurora-text hover:border-aurora-accent/50 shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 text-sm opacity-70 font-mono mb-1">
                                        {isTask ? (
                                            <ListTodo className="w-3 h-3" />
                                        ) : isGoogleEvent ? (
                                            <Calendar className="w-3 h-3" />
                                        ) : (
                                            <Clock className="w-3 h-3" />
                                        )}
                                        <span>
                                            {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                                        </span>
                                    </div>
                                    <h3 className="font-medium text-lg">{event.title}</h3>
                                    {event.description && (
                                        <p className="text-sm text-aurora-muted mt-1">{event.description}</p>
                                    )}
                                </div>

                                {!isBreak && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSkip(event)}
                                            className="p-2 hover:bg-gray-100 rounded-full text-aurora-muted hover:text-aurora-accent transition-colors"
                                            title="Skip & Reschedule"
                                        >
                                            <SkipForward className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-gray-100 rounded-full text-aurora-muted hover:text-green-500 transition-colors">
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
