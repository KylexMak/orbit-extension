import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Onboarding } from './views/Onboarding';
import { Home } from './views/Home';
import { Chat } from './views/Chat';
import { Focus } from './views/Focus';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';

function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'focus'>('home');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (data) setHasProfile(true);
      else setHasProfile(false);
    } catch (e) {
      console.error(e);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Error signing in:', error);
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-screen flex items-center justify-center bg-aurora-bg">
          <Loader2 className="w-8 h-8 animate-spin text-aurora-primary" />
        </div>
      );
    }

    if (!session) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-aurora-bg p-6 space-y-4">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-aurora-primary to-aurora-secondary">Orbit</h1>
          <p className="text-aurora-muted text-center max-w-xs">Your personal time and social supportive assistant.</p>
          <button
            onClick={handleAnonymousLogin}
            className="px-4 py-2 bg-aurora-primary text-white rounded-md hover:bg-aurora-primary/90 transition shadow-sm"
          >
            Enter Orbit
          </button>
        </div>
      );
    }

    if (!hasProfile) {
      return <Onboarding onComplete={() => setHasProfile(true)} />;
    }

    const ViewComponent = {
      home: Home,
      chat: Chat,
      focus: Focus,
    }[activeTab];

    const openSettings = () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    };

    return (
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onProfileClick={openSettings}
      >
        <ViewComponent />
      </Layout>
    );
  };

  return renderContent();
}

export default App;
