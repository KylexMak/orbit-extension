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
  const [showSettings, setShowSettings] = useState(false);

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
        <div className="h-screen flex items-center justify-center bg-aurora-bg text-aurora-primary">
          <Loader2 className="w-8 h-8 animate-spin" />
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
            className="px-4 py-2 bg-aurora-primary text-white rounded-md hover:bg-opacity-90 transition"
          >
            Enter Orbit
          </button>
        </div>
      );
    }

    if (!hasProfile && !showSettings) {
      return <Onboarding onComplete={() => setHasProfile(true)} />;
    }

    const ViewComponent = {
      home: Home,
      chat: Chat,
      focus: Focus,
    }[activeTab];

    return (
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onProfileClick={() => setShowSettings(true)}
      >
        {showSettings ? (
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-aurora-primary hover:text-aurora-accent">Close</button>
            </div>
            <Onboarding onComplete={() => setShowSettings(false)} />

            <div className="mt-auto text-center text-xs text-aurora-muted p-4">
              v1.0.0 • Orbit
            </div>
          </div>
        ) : (
          <ViewComponent />
        )}
      </Layout>
    );
  };

  return renderContent();
}

export default App;
