import React from 'react';
import { Home, MessageCircle, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: 'home' | 'chat' | 'focus';
    onTabChange: (tab: 'home' | 'chat' | 'focus') => void;
    onProfileClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onProfileClick }) => {
    return (
        <div className="flex flex-col h-full w-full bg-aurora-bg">
            {/* Sticky top section: header + nav */}
            <div className="sticky top-0 z-10">
                {/* Header with gradient */}
                <header className="bg-gradient-to-r from-purple-500 via-purple-400 to-blue-400 px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Orbit</h1>
                            <p className="text-white/80 text-sm mt-0.5">Your supportive daily companion</p>
                        </div>
                        <button
                            onClick={onProfileClick}
                            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md flex-shrink-0"
                        >
                            <span className="text-aurora-primary font-bold text-sm">ME</span>
                        </button>
                    </div>
                </header>

                {/* Top Navigation */}
                <nav className="flex items-center bg-gray-100 border-b border-gray-200 shadow-sm">
                    <NavButton
                        active={activeTab === 'home'}
                        onClick={() => onTabChange('home')}
                        icon={<Home className="w-5 h-5" />}
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
                        icon={<Users className="w-5 h-5" />}
                        label="Focus"
                    />
                </nav>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4">
                {children}
            </main>
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
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-200",
            active
                ? "text-aurora-primary bg-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
        )}
    >
        {icon}
        <span>{label}</span>
    </button>
);
