import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getGeminiResponse } from '../lib/gemini';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MessageSquare, Bot, Send } from 'lucide-react';
import { cn } from '../lib/utils';


interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    sender_name?: string; // Optional for now
    is_bot?: boolean;
}

export const Chat = () => {
    const [mode, setMode] = useState<'community' | 'bob'>('community');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingAI, setLoadingAI] = useState(false);

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
            // Bob mode local state check? 
            // We might want to persist Bob chat, but for MVP let's keep it ephemeral or just mock it.
            // Actually, let's just clear messages when switching to Bob for this MVP version, 
            // to avoid complexity of storing private AI chats in DB.
            setMessages([
                { id: 'welcome', user_id: 'bob', content: "Hi! I'm Bob. How are you feeling today?", created_at: new Date().toISOString(), is_bot: true }
            ]);
        }
    }, [mode]);

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
            // Bob Mode
            // 1. Add user message locally
            const userMsg: Message = {
                id: Date.now().toString(),
                user_id: currentUserId,
                content: text,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, userMsg]);
            setLoadingAI(true);

            // 2. Get AI response
            const aiResponse = await getGeminiResponse(text);

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

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="flex justify-center space-x-2 mb-4">
                <button
                    onClick={() => setMode('community')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", mode === 'community' ? "bg-aurora-primary text-white" : "bg-aurora-card text-aurora-muted hover:text-aurora-text")}
                >
                    <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Community</div>
                </button>
                <button
                    onClick={() => setMode('bob')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", mode === 'bob' ? "bg-aurora-secondary text-white" : "bg-aurora-card text-aurora-muted hover:text-aurora-text")}
                >
                    <div className="flex items-center gap-2"><Bot className="w-4 h-4" /> Bob (AI)</div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 scrollbar-thin" ref={scrollRef}>
                {messages.map((msg) => {
                    const isMe = msg.user_id === currentUserId;
                    const isBob = msg.is_bot || msg.user_id === 'bob'; // Check both for safety

                    return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                isMe ? "bg-aurora-primary text-white rounded-br-none" :
                                    isBob ? "bg-aurora-secondary text-white rounded-bl-none" :
                                        "bg-aurora-card text-aurora-text rounded-bl-none"
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
