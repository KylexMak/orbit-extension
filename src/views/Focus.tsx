import { useState, useEffect, useRef } from 'react';
import { Users, Headphones, Coffee, BookOpen, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

interface Room {
    id: number;
    name: string;
    icon: React.FC<{ className?: string }>;
    count: number;
    color: string;
}

interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    room_id?: number;
}

const rooms: Room[] = [
    { id: 1, name: 'Deep Work Station', icon: BookOpen, count: 124, color: 'text-indigo-500' },
    { id: 2, name: 'Lofi & Chill', icon: Headphones, count: 85, color: 'text-rose-400' },
    { id: 3, name: 'Lunch Club', icon: Coffee, count: 12, color: 'text-amber-500' },
];

const meetups = [
    { id: 1, name: 'Campus Yoga', time: '5:00 PM', distance: '0.2 mi' },
    { id: 2, name: 'Study Group: Math', time: '6:30 PM', distance: 'Lib 2nd Floor' },
];

const RoomChat = ({ room, onBack }: { room: Room; onBack: () => void }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const channelName = `room:${room.id}`;

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id || null);
        });

        fetchMessages();

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_messages',
                filter: `room_id=eq.${room.id}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [room.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('room_messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setMessages(data.reverse());
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !currentUserId) return;

        const text = inputText;
        setInputText('');

        const { error } = await supabase.from('room_messages').insert({
            user_id: currentUserId,
            content: text,
            room_id: room.id
        });
        if (error) console.error(error);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Room header */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 mb-3">
                <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-aurora-muted" />
                </button>
                <div className={`p-2 rounded-full bg-aurora-bg ${room.color}`}>
                    <room.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-aurora-text text-sm">{room.name}</h3>
                    <p className="text-xs text-aurora-muted">{room.count} online</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center text-aurora-muted text-sm py-8">
                        <p>No messages yet.</p>
                        <p className="text-xs mt-1">Be the first to say something!</p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.user_id === currentUserId;
                    return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                isMe
                                    ? "bg-aurora-primary text-white rounded-br-none"
                                    : "bg-white text-aurora-text border border-gray-200 rounded-bl-none"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2">
                <Input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={`Message ${room.name}...`}
                    className="rounded-full"
                />
                <Button type="submit" size="sm" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
};

export const Focus = () => {
    const [activeRoom, setActiveRoom] = useState<Room | null>(null);

    if (activeRoom) {
        return <RoomChat room={activeRoom} onBack={() => setActiveRoom(null)} />;
    }

    return (
        <div className="space-y-6">
            <section>
                <h2 className="text-xl font-bold text-aurora-text mb-4">Live Rooms</h2>
                <div className="grid grid-cols-1 gap-3">
                    {rooms.map((room) => (
                        <div
                            key={room.id}
                            onClick={() => setActiveRoom(room)}
                            className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer group"
                        >
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
                        </div>
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
