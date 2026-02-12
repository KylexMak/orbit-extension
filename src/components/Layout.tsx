import React from 'react';
import { LayoutDashboard, MessageCircle, Tent, UserCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: 'home' | 'chat' | 'focus';
    onTabChange: (tab: 'home' | 'chat' | 'focus') => void;
    onProfileClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onProfileClick }) => {
    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-br from-aurora-bg via-[#1f2937] to-aurora-bg">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-aurora-muted/10 bg-aurora-bg/50 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-aurora-primary to-aurora-secondary animate-pulse-slow"></div>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-aurora-primary to-aurora-secondary">
                        Orbit
                    </h1>
                </div>
                <button onClick={onProfileClick} className="text-aurora-muted hover:text-aurora-text transition-colors">
                    <UserCircle className="w-6 h-6" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {children}
            </main>

            {/* Bottom Nav */}
            <nav className="flex items-center justify-around p-2 bg-aurora-bg/80 backdrop-blur-md border-t border-aurora-muted/10">
                <NavButton
                    active={activeTab === 'home'}
                    onClick={() => onTabChange('home')}
                    icon={<LayoutDashboard className="w-5 h-5" />}
                    label="Home"
                />
                <NavButton
                    active={activeTab === 'chat'}
                    onClick={() => onTabChange('chat')}
                    icon={<MessageCircle className="w-5 h-5" />}
                    label="Chat"
                />
                <NavButton
                    active={activeTab === 'focus'}
                    onClick={() => onTabChange('focus')}
                    icon={<Tent className="w-5 h-5" />}
                    label="Focus"
                />
            </nav>
        </div>
    );
};

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 w-16",
            active ? "text-aurora-accent bg-aurora-primary/10" : "text-aurora-muted hover:text-aurora-text"
        )}
    >
        {icon}
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
);
