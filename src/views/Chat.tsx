import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getGeminiResponse } from '../lib/gemini';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MessageSquare, Bot, Send, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';


interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    is_bot?: boolean;
}

export const Chat = ({ session }: { session?: any }) => {
    const [mode, setMode] = useState<'community' | 'bob'>('community');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [todayEvents, setTodayEvents] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id || null);
        });

        if (mode === 'community') {
            fetchCommunityMessages();
            const channel = supabase
                .channel('public:messages')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages(prev => [...prev, newMessage]);
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        } else {
            setMessages([
                { id: 'welcome', user_id: 'bob', content: "Hi! I'm Bob. How are you feeling today?", created_at: new Date().toISOString(), is_bot: true }
            ]);
            // Fetch today's events for Bob's context
            if (session?.provider_token) {
                import('../lib/googleCalendar').then(({ getUpcomingEvents }) => {
                    getUpcomingEvents(session.provider_token).then(events => {
                        const summary = events.map(ev => {
                            const time = ev.start.dateTime
                                ? format(new Date(ev.start.dateTime), 'h:mm a')
                                : ev.start.date || '';
                            return `- ${time}: ${ev.summary}`;
                        }).join('\n');
                        setTodayEvents(summary);
                    }).catch(err => console.error('Failed to fetch events for chat context:', err));
                });
            }
        }
    }, [mode, session?.provider_token]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchCommunityMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setMessages(data.reverse());
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !currentUserId) return;

        const text = inputText;
        setInputText('');

        if (mode === 'community') {
            const { error } = await supabase.from('messages').insert({
                user_id: currentUserId,
                content: text
            });
            if (error) console.error(error);
        } else {
            const userMsg: Message = {
                id: Date.now().toString(),
                user_id: currentUserId,
                content: text,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, userMsg]);
            setLoadingAI(true);

            // Build chat history from recent messages (skip welcome)
            const recentMessages = [...messages, userMsg]
                .filter(m => m.id !== 'welcome')
                .slice(-10)
                .map(m => `${m.is_bot ? 'Bob' : 'User'}: ${m.content}`)
                .join('\n');

            const aiResponse = await getGeminiResponse(text, {
                todayEvents: todayEvents || undefined,
                chatHistory: recentMessages || undefined,
            });

            const bobMsg: Message = {
                id: (Date.now() + 1).toString(),
                user_id: 'bob',
                content: aiResponse,
                created_at: new Date().toISOString(),
                is_bot: true
            };
            setMessages(prev => [...prev, bobMsg]);
            setLoadingAI(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        if (mode === 'community') {
            await fetchCommunityMessages();
        } else {
            setMessages([
                { id: 'welcome', user_id: 'bob', content: "Hi! I'm Bob. How are you feeling today?", created_at: new Date().toISOString(), is_bot: true }
            ]);
        }
        setRefreshing(false);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-center items-center space-x-2 mb-4">
                <button
                    onClick={() => setMode('community')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", mode === 'community' ? "bg-aurora-primary text-white shadow-sm" : "bg-white text-aurora-muted border border-gray-200 hover:text-aurora-text")}
                >
                    <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Community</div>
                </button>
                <button
                    onClick={() => setMode('bob')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", mode === 'bob' ? "bg-aurora-secondary text-white shadow-sm" : "bg-white text-aurora-muted border border-gray-200 hover:text-aurora-text")}
                >
                    <div className="flex items-center gap-2"><Bot className="w-4 h-4" /> Bob (AI)</div>
                </button>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 rounded-full text-aurora-muted hover:text-aurora-text hover:bg-gray-100 transition-colors"
                    title="Refresh chat"
                >
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2" ref={scrollRef}>
                {messages.map((msg) => {
                    const isMe = msg.user_id === currentUserId;
                    const isBob = msg.is_bot || msg.user_id === 'bob';

                    return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                isMe ? "bg-aurora-primary text-white rounded-br-none" :
                                    isBob ? "bg-aurora-secondary text-white rounded-bl-none" :
                                        "bg-white text-aurora-text border border-gray-200 rounded-bl-none"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    )
                })}
                {loadingAI && <div className="text-xs text-aurora-muted animate-pulse ml-2">Bob is thinking...</div>}
            </div>

            <form onSubmit={handleSend} className="flex gap-2">
                <Input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={mode === 'community' ? "Say hello..." : "Ask Bob for support..."}
                    className="rounded-full"
                />
                <Button type="submit" size="sm" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
};
