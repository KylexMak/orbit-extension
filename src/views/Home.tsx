import React, { useState, useEffect } from 'react';
import { useOrbitEvents } from '../hooks/useOrbitEvents';
import { injectSmartBreaks, calculateNextAvailableSlot, type Event } from '../lib/scheduleUtils';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, SkipForward, CheckCircle, Calendar, ListTodo, Clock, Download, CalendarPlus } from 'lucide-react';
import { format, differenceInMinutes, addHours, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';
import { detectDatesInText, buildIcsFile, downloadIcs, type CapturedDateItem } from '../lib/dateCapture';

export const Home = () => {
    const { events, loading, addEvent, skipEvent } = useOrbitEvents();
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

    const [capturedItems, setCapturedItems] = useState<CapturedDateItem[]>([]);
    const [capturedSelected, setCapturedSelected] = useState<Set<string>>(new Set());
    const [captureLoading, setCaptureLoading] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);

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
        
        const now = new Date();
        let start: Date;
        let end: Date;

        if (newItemType === 'task') {
            // Task: due date (and optional time)
            start = startOfDay(new Date(newDueDate));
            if (newDueTime) {
                const [hours, minutes] = newDueTime.split(':').map(Number);
                start.setHours(hours, minutes, 0, 0);
            }
            end = addHours(start, 1); // DB needs end; use 1hr block for display
        } else {
            // Event: start and end time
            if (newStartTime) {
                const [hours, minutes] = newStartTime.split(':').map(Number);
                start = new Date(now);
                start.setHours(hours, minutes, 0, 0);
                if (start < now) start.setDate(start.getDate() + 1);
            } else {
                start = now;
            }
            if (newEndTime) {
                const [h, m] = newEndTime.split(':').map(Number);
                end = new Date(start);
                end.setHours(h, m, 0, 0);
                if (end <= start) end.setDate(end.getDate() + 1);
            } else {
                end = addHours(start, 1);
            }
        }

        // Sync to Google Calendar first for events so we can store the id in one insert
        let googleId: string | undefined;
        if (newItemType === 'event') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.provider_token) {
                try {
                    const { createEvent } = await import('../lib/googleCalendar');
                    const created = await createEvent(
                        session.provider_token, 
                        newTitle, 
                        start, 
                        end, 
                        newDescription || undefined
                    );
                    if (created) {
                        googleId = created.id;
                        await fetchGoogleData(session.provider_token, session.user.id);
                    }
                } catch (err) {
                    console.error("Failed to sync to Google Calendar", err);
                }
            }
        }

        await addEvent(newTitle, start, end, newDescription || undefined, googleId, newItemType);

        setNewTitle('');
        setNewDescription('');
        setNewItemType('event');
        setNewDueDate(format(new Date(), 'yyyy-MM-dd'));
        setNewDueTime('');
        setNewStartTime('');
        setNewEndTime('');
        setShowAddForm(false);
    };

    const handleCaptureFromPage = async () => {
        setCaptureLoading(true);
        setCaptureError(null);
        setCapturedItems([]);
        setCapturedSelected(new Set());
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
            setCaptureError('Open this from the Orbit extension popup on a webpage.');
            setCaptureLoading(false);
            return;
        }
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                setCaptureError('No active tab found.');
                setCaptureLoading(false);
                return;
            }
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({ text: document.body?.innerText ?? '', title: document.title ?? '' }),
            });
            const { text = '', title = '' } = results?.[0]?.result ?? {};
            const items = detectDatesInText(text, title);
            setCapturedItems(items);
            setCapturedSelected(new Set(items.map((i) => i.id)));
            if (items.length === 0) setCaptureError('No dates or deadlines found on this page.');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Could not read page. Try a normal webpage (not chrome://).';
            setCaptureError(msg);
        }
        setCaptureLoading(false);
    };

    const handleExportToGoogle = async () => {
        const selected = capturedItems.filter((i) => capturedSelected.has(i.id));
        if (selected.length === 0) {
            alert('Select at least one item.');
            return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.provider_token) {
            alert('Sign in with Google first to export to Google Calendar.');
            return;
        }
        try {
            const { createEvent } = await import('../lib/googleCalendar');
            for (const item of selected) {
                const end = item.endDate ?? new Date(item.date.getTime() + 60 * 60 * 1000);
                await createEvent(session.provider_token, item.title, item.date, end, item.context);
            }
            await fetchGoogleData(session.provider_token, session.user.id);
            alert(`Added ${selected.length} event(s) to Google Calendar.`);
            setCapturedItems([]);
        } catch (err) {
            console.error(err);
            alert('Failed to add to Google Calendar. Try again.');
        }
    };

    const handleDownloadIcs = () => {
        const selected = capturedItems.filter((i) => capturedSelected.has(i.id));
        if (selected.length === 0) {
            alert('Select at least one item.');
            return;
        }
        const ics = buildIcsFile(selected);
        downloadIcs(ics, `orbit-captured-${format(new Date(), 'yyyy-MM-dd')}.ics`);
        alert(`Downloaded ${selected.length} event(s). Import the .ics file into Google Calendar.`);
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

            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <CalendarPlus className="w-4 h-4 text-aurora-primary" />
                            <span className="text-sm font-medium text-aurora-text">Capture from page</span>
                        </div>
                        <p className="text-xs text-aurora-muted">
                            Detect dates and deadlines on the current tab. Export to Google Calendar or download an .ics file.
                        </p>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCaptureFromPage}
                            disabled={captureLoading}
                            className="w-full"
                        >
                            {captureLoading ? 'Scanning...' : 'Capture dates from this page'}
                        </Button>
                        {captureError && (
                            <p className="text-xs text-amber-600">{captureError}</p>
                        )}
                        {capturedItems.length > 0 && (
                            <div className="space-y-2 animate-in fade-in">
                                <p className="text-xs font-medium text-aurora-text">Detected ({capturedItems.length})</p>
                                <div className="max-h-32 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                    {capturedItems.map((item) => (
                                        <label key={item.id} className="flex items-start gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={capturedSelected.has(item.id)}
                                                onChange={(e) => {
                                                    setCapturedSelected((prev) => {
                                                        const next = new Set(prev);
                                                        if (e.target.checked) next.add(item.id);
                                                        else next.delete(item.id);
                                                        return next;
                                                    });
                                                }}
                                                className="mt-1 rounded border-gray-300"
                                            />
                                            <span className="text-xs text-aurora-text flex-1 min-w-0">
                                                <span className="font-medium truncate block">{item.title || 'Event'}</span>
                                                <span className="text-aurora-muted">{format(item.date, 'MMM d, yyyy')}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleExportToGoogle} className="flex-1">
                                        <Calendar className="w-3.5 h-3.5 mr-1" />
                                        Google Calendar
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={handleDownloadIcs} className="flex-1">
                                        <Download className="w-3.5 h-3.5 mr-1" />
                                        Download .ics
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

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
                    const isGoogleEvent = !!event.google_calendar_id;
                    const isEvent = !isBreak && !isTask;
                    
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
