
import { Card, CardContent } from '../components/ui/Card';
import { Users, Headphones, Coffee, BookOpen } from 'lucide-react';

const rooms = [
    { id: 1, name: 'Deep Work Station', icon: BookOpen, count: 124, color: 'text-indigo-500' },
    { id: 2, name: 'Lofi & Chill', icon: Headphones, count: 85, color: 'text-rose-400' },
    { id: 3, name: 'Lunch Club', icon: Coffee, count: 12, color: 'text-amber-500' },
];

const meetups = [
    { id: 1, name: 'Campus Yoga', time: '5:00 PM', distance: '0.2 mi' },
    { id: 2, name: 'Study Group: Math', time: '6:30 PM', distance: 'Lib 2nd Floor' },
];

export const Focus = () => {
    return (
        <div className="space-y-6">
            <section>
                <h2 className="text-xl font-bold text-aurora-text mb-4">Live Rooms</h2>
                <div className="grid grid-cols-1 gap-3">
                    {rooms.map((room) => (
                        <Card key={room.id} className="hover:shadow-md transition cursor-pointer group">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full bg-aurora-bg ${room.color} group-hover:scale-110 transition`}>
                                        <room.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-aurora-text">{room.name}</h3>
                                        <p className="text-xs text-aurora-muted">Active Now</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-aurora-muted text-sm bg-aurora-bg px-2 py-1 rounded-full">
                                    <Users className="w-3 h-3" />
                                    <span>{room.count}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-aurora-text mb-4">Happening Nearby</h2>
                <div className="space-y-2">
                    {meetups.map(m => (
                        <div key={m.id} className="flex justify-between items-center p-3 rounded-lg bg-white border border-gray-200 hover:shadow-sm transition">
                            <div>
                                <div className="font-medium text-aurora-text">{m.name}</div>
                                <div className="text-xs text-aurora-muted">{m.distance}</div>
                            </div>
                            <div className="text-sm font-mono text-aurora-primary">
                                {m.time}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
