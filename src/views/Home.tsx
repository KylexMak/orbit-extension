import React, { useState, useEffect } from 'react';
import { useOrbitEvents } from '../hooks/useOrbitEvents';
import { injectSmartBreaks, calculateNextAvailableSlot, type Event } from '../lib/scheduleUtils';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, SkipForward, CheckCircle, Calendar, ListTodo, Clock } from 'lucide-react';
import { format, differenceInMinutes, addHours } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';

export const Home = ({ session, onConnectCalendar }: { session: any, onConnectCalendar: () => void }) => {
    const { events, loading, skipEvent, deleteEvent } = useOrbitEvents();
    const [displayEvents, setDisplayEvents] = useState<Event[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newItemType, setNewItemType] = useState<'task' | 'event'>('event');
    const [newDueDate, setNewDueDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [newDueTime, setNewDueTime] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [profile, setProfile] = useState<{ sleep_start: string, sleep_end: string } | null>(null);

    const [googleEvents, setGoogleEvents] = useState<Event[]>([]);
    const [googleTasks, setGoogleTasks] = useState<Event[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        // Determine profile for sleep schedule
        if (session?.user) {
            supabase.from('profiles').select('*').eq('id', session.user.id).single()
                .then(({ data }) => setProfile(data));

            if (session.provider_token) {
                console.log('[Home] Session has provider_token, fetching data...');
                fetchGoogleData(session.provider_token, session.user.id);
            } else {
                console.log('[Home] Session missing provider_token, skipping fetch.');
            }
        }
    }, [session]);

    const fetchGoogleData = async (providerToken: string, userId: string) => {
        setFetchError(null);
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
        } catch (err: any) {
            console.error('Error fetching Google data:', err);
            setFetchError(err.message || 'Failed to sync');
        }
    };

    useEffect(() => {
        // Create a Set of Google Event IDs to filter out local shadows
        const googleEventIds = new Set(googleEvents.map(ge => ge.google_calendar_id).filter(Boolean));

        // Filter out local events that are already represented by a Google Event
        const filteredLocalEvents = events.filter(e => !e.google_calendar_id || !googleEventIds.has(e.google_calendar_id));

        const allEvents = [...filteredLocalEvents, ...googleEvents, ...googleTasks].sort((a, b) =>
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

        // Check for Google connection first
        if (!session?.provider_token) {
            alert('Please connect to Google Calendar (top right) to add events.');
            return;
        }

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
                // Refresh Google data to show the new event
                await fetchGoogleData(session.provider_token, session.user.id);
            }
        } catch (err) {
            console.error("Failed to create event in Google Calendar", err);
            alert('Failed to create event in Google Calendar.');
        }

        setNewTitle('');
        setNewDescription('');
        setNewItemType('event');
        setNewDueDate(format(new Date(), 'yyyy-MM-dd'));
        setNewDueTime('');
        setNewStartTime('');
        setNewEndTime('');
        setShowAddForm(false);
    };

    const handleDelete = async (event: Event) => {
        if (confirm('Are you sure you want to delete this task?')) {
            // Optimistic UI Update: Remove immediately from view
            if (event.google_calendar_id) {
                setGoogleEvents(prev => prev.filter(e => e.id !== event.id));
            } else if (event.google_task_id) {
                setGoogleTasks(prev => prev.filter(e => e.id !== event.id));
            }

            // Real Excecution
            if (event.google_calendar_id && session?.provider_token) {
                try {
                    const { deleteEvent: deleteGoogleEvent } = await import('../lib/googleCalendar');
                    await deleteGoogleEvent(session.provider_token, event.google_calendar_id);
                    // Background sync to ensure consistency
                    fetchGoogleData(session.provider_token, session.user.id);
                } catch (err) {
                    console.error('Failed to delete from Google Calendar:', err);
                    alert('Failed to delete from Google Calendar. It may reappear on refresh.');
                    // Revert? For now, we assume success or next refresh fixes it.
                }
            } else {
                // Only delete locally if it's NOT a Google event (legacy support)
                deleteEvent(event.id);
            }
        }
    };

    const handleInsertWellnessBreaks = async () => {
        if (!session?.provider_token) {
            onConnectCalendar();
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
            {/* Google Calendar Connection Banner */}
            {!session?.provider_token && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Connect Google Calendar</span>
                    </div>
                    <Button size="sm" onClick={onConnectCalendar} variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200">
                        Connect
                    </Button>
                </div>
            )}

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

            {fetchError && (
                <div className="bg-red-50 text-red-600 text-xs p-2 rounded border border-red-200">
                    Sync Error: {fetchError}
                </div>
            )}

            {showAddForm && (
                <Card className="animate-in fade-in slide-in-from-top-4">
                    <CardContent className="pt-4">
                        <form onSubmit={handleCreate} className="space-y-3">
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setNewItemType('task')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${newItemType === 'task'
                                        ? 'bg-blue-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Task
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewItemType('event')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${newItemType === 'event'
                                        ? 'bg-blue-100 text-blue-900 border-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Event
                                </button>
                            </div>
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
                            {newItemType === 'task' ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs text-aurora-muted mb-1 block">Due date</label>
                                        <Input
                                            type="date"
                                            value={newDueDate}
                                            onChange={e => setNewDueDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-aurora-muted mb-1 block">Due time (optional)</label>
                                        <Input
                                            type="time"
                                            value={newDueTime}
                                            onChange={e => setNewDueTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
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
                            )}
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
                    const isEvent = event.type === 'event';
                    const isGoogleEvent = !!event.google_calendar_id;

                    return (
                        <div
                            key={event.id}
                            className={`relative p-4 rounded-xl border transition-all ${isBreak
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : isTask
                                    ? 'bg-blue-900 border-blue-800 text-white hover:border-blue-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-900 hover:border-blue-300'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className={`flex items-center gap-2 text-sm font-mono mb-1 ${isTask ? 'text-blue-200' : isEvent ? 'text-blue-700 opacity-90' : ''}`}>
                                        {isTask ? (
                                            <ListTodo className="w-3 h-3" />
                                        ) : isGoogleEvent ? (
                                            <Calendar className="w-3 h-3" />
                                        ) : (
                                            <Clock className="w-3 h-3" />
                                        )}
                                        <span>
                                            {isTask
                                                ? (() => {
                                                    const d = new Date(event.start_time);
                                                    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                                                    return `Due: ${format(d, 'MMM d, yyyy')}${hasTime ? ` at ${format(d, 'h:mm a')}` : ''}`;
                                                })()
                                                : `${format(new Date(event.start_time), 'h:mm a')} - ${format(new Date(event.end_time), 'h:mm a')}`}
                                        </span>
                                    </div>
                                    <h3 className="font-medium text-lg">{event.title}</h3>
                                    {event.description && (
                                        <p className={`text-sm mt-1 ${isTask ? 'text-blue-200' : 'text-aurora-muted'}`}>{event.description}</p>
                                    )}
                                </div>

                                {!isBreak && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSkip(event)}
                                            className={`p-2 rounded-full transition-colors ${isTask ? 'hover:bg-blue-800 text-blue-200 hover:text-white' : 'hover:bg-blue-100 text-aurora-muted hover:text-aurora-accent'}`}
                                            title="Skip & Reschedule"
                                        >
                                            <SkipForward className="w-4 h-4" />
                                        </button>
                                        <button className={`p-2 rounded-full transition-colors ${isTask ? 'hover:bg-blue-800 text-blue-200 hover:text-green-400' : 'hover:bg-blue-100 text-aurora-muted hover:text-green-500'}`}>
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(event)}
                                            className="p-2 hover:bg-red-100 rounded-full text-aurora-muted hover:text-red-500 transition-colors"
                                            title="Delete"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
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
