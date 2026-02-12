import React, { useState, useEffect } from 'react';
import { useOrbitEvents } from '../hooks/useOrbitEvents';
import { injectSmartBreaks, calculateNextAvailableSlot, type Event } from '../lib/scheduleUtils';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, SkipForward, CheckCircle } from 'lucide-react';
import { format, differenceInMinutes, addHours } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';

export const Home = () => {
    const { events, loading, addEvent, skipEvent } = useOrbitEvents();
    const [displayEvents, setDisplayEvents] = useState<Event[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [profile, setProfile] = useState<{ sleep_start: string, sleep_end: string } | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(data);
            }
        });
    }, []);

    useEffect(() => {
        const withBreaks = injectSmartBreaks(events);
        setDisplayEvents(withBreaks);
    }, [events]);

    const handleSkip = (event: Event) => {
        if (!profile) return;
        const duration = differenceInMinutes(new Date(event.end_time), new Date(event.start_time));
        const { start, end } = calculateNextAvailableSlot(duration, events, profile.sleep_start, profile.sleep_end);

        skipEvent(event, start, end);
        alert(`No worries! We moved this to ${format(start, 'h:mm a')} so you can rest.`);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const start = new Date();
        const end = addHours(start, 1);
        await addEvent(newTitle, start, end);
        setNewTitle('');
        setShowAddForm(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-aurora-text">Your Rhythm</h2>
                <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            {showAddForm && (
                <Card className="animate-in fade-in slide-in-from-top-4">
                    <CardContent className="pt-4">
                        <form onSubmit={handleCreate} className="flex gap-2">
                            <Input
                                placeholder="What needs doing?"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                autoFocus
                            />
                            <Button type="submit">Add</Button>
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
                    return (
                        <div
                            key={event.id}
                            className={`relative p-4 rounded-xl border transition-all ${isBreak
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-white border-gray-200 text-aurora-text hover:border-aurora-accent/50 shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm opacity-70 font-mono mb-1">
                                        {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                                    </div>
                                    <h3 className="font-medium text-lg">{event.title}</h3>
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
