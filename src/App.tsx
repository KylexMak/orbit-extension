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
  const [debugStatus, setDebugStatus] = useState('Initializing...');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'focus'>('home');
  const [showSettings, setShowSettings] = useState(false);

  // Consume auth tokens stored by the background service worker in chrome.storage.local
  const consumeStoredTokens = async () => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

    const result = await chrome.storage.local.get(['auth_tokens', 'auth_error']);

    if (result.auth_error) {
      setDebugStatus(`Auth Error: ${result.auth_error}`);
      await chrome.storage.local.remove(['auth_error']);
      setLoading(false);
      return;
    }

    if (result.auth_tokens) {
      setDebugStatus('Found pending tokens. Setting Supabase session...');
      const tokens = result.auth_tokens as any;
      const { access_token, refresh_token, provider_token } = tokens;

      // Persist provider_token aggressively
      if (provider_token) {
        console.log('[App] Persisting provider_token to orbit_provider_token');
        await chrome.storage.local.set({ orbit_provider_token: provider_token });
      }

      await chrome.storage.local.remove(['auth_tokens']);

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || '',
      });

      if (error) {
        setDebugStatus(`SetSession Error: ${error.message}`);
        setLoading(false);
      } else {
        setDebugStatus('Session set! Waiting for auth listener...');
        // Do NOT manually setSession here. onAuthStateChange will fire and pick up the token from storage.
      }
    }
  };

  useEffect(() => {
    // Safety timeout
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setDebugStatus('Loading timed out. Please check console or network.');
          return false;
        }
        return prev;
      });
    }, 10000);

    const initializeSession = async () => {
      setDebugStatus('Checking session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let currentSession = session as any;

        // Try to recover provider_token from CONSTANT storage
        if (currentSession && typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(['orbit_provider_token']);
          console.log('[App] Initial persistent storage check:', result);

          if (result.orbit_provider_token) {
            console.log('[App] Restoring provider_token from persistent storage');
            // CLONE the session to ensure React sees a new object
            currentSession = { ...currentSession, provider_token: result.orbit_provider_token };
          }
        }

        setSession(currentSession);

        if (currentSession) {
          setDebugStatus('Session found. Checking profile...');
          await checkProfile(currentSession.user.id);
        } else {
          // No existing session — check if background worker stored tokens while popup was closed
          await consumeStoredTokens();
          // Re-check
          const { data: { session: rechecked } } = await supabase.auth.getSession();
          if (!rechecked) {
            setDebugStatus('No session found.');
            setLoading(false);
          }
        }
      } catch (error: any) {
        console.error('Error getting session:', error);
        setDebugStatus(`Error: ${error.message}`);
        setLoading(false);
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let currentSession = session as any;

      // Try to recover provider_token from CONSTANT storage (on change too)
      if (currentSession && typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(['orbit_provider_token']);
        if (result.orbit_provider_token) {
          console.log('[App] Restoring provider_token on auth change (persistent)');
          currentSession = { ...currentSession, provider_token: result.orbit_provider_token };
        }
      }

      setSession(currentSession);
      if (currentSession) {
        setDebugStatus('Auth state changed. Checking profile...');
        checkProfile(currentSession.user.id);
      }
      else if (!currentSession && loading) {
        setLoading(false);
      }
    });

    // Listen for storage changes in case background worker stores tokens while popup is open
    const storageListener = async (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.auth_tokens?.newValue) {
        console.log('[App] Storage changed, consuming tokens...');
        await consumeStoredTokens();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(storageListener);
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, []);

  const checkProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (data) {
        setDebugStatus('Profile found.');
        setHasProfile(true);
      } else {
        setDebugStatus('No profile found.');
        setHasProfile(false);
      }
    } catch (e) {
      console.error(e);
      setDebugStatus('Error checking profile.');
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthUrl(null);
    setDebugStatus('Initiating Google Login via Chrome Identity...');

    // Environment check: Are we in a Chrome Extension?
    const isExtension = typeof chrome !== 'undefined' && chrome.identity && chrome.identity.launchWebAuthFlow;

    if (!isExtension) {
      setDebugStatus('Not in extension. Redirecting via standard web flow...');
      // Standard web fallback (e.g. for localhost)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks',
          redirectTo: window.location.origin
        }
      });
      if (error) {
        console.error('Error signing in:', error);
        setDebugStatus(`Login Error: ${error.message}`);
        setLoading(false);
      }
      return;
    }

    // 1. Get the Auth URL from Supabase
    const redirectUrl = chrome.identity.getRedirectURL();

    setDebugStatus('Getting Auth URL from Supabase...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks',
        redirectTo: redirectUrl,
        skipBrowserRedirect: true
      }
    });

    if (error) {
      setDebugStatus(`Error generating Auth URL: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setDebugStatus('No Auth URL returned from Supabase.');
      setLoading(false);
      return;
    }

    // 2. Send auth URL to background service worker (survives popup closing on Mac)
    setDebugStatus('Sending auth to background worker...');

    try {
      chrome.runtime.sendMessage(
        { type: 'START_AUTH', url: data.url },
        async (response) => {
          // This callback only fires if the popup is still open when auth completes.
          // If the popup closed (Mac behavior), tokens are in chrome.storage.local
          // and will be consumed on next popup open via consumeStoredTokens().
          if (!response) return;

          if (response.success) {
            setDebugStatus('Got tokens. Setting Supabase session...');

            // IMMEDIATE PERSISTENCE
            if (response.provider_token) {
              console.log('[App] handleGoogleLogin: Persisting provider_token immediately');
              await chrome.storage.local.set({ orbit_provider_token: response.provider_token });
              // Clean up temp tokens since we have what we need
              await chrome.storage.local.remove(['auth_tokens']);
            }

            const { error } = await supabase.auth.setSession({
              access_token: response.access_token,
              refresh_token: response.refresh_token || '',
            });

            if (error) {
              setDebugStatus(`SetSession Error: ${error.message}`);
              setLoading(false);
            } else {
              setDebugStatus('Session set!');
              const { data: { session } } = await supabase.auth.getSession();

              // Patch the session object immediately so the UI updates
              let currentSession = session as any;
              if (currentSession && response.provider_token) {
                currentSession = { ...currentSession, provider_token: response.provider_token };
              }

              setSession(currentSession);
              if (currentSession) checkProfile(currentSession.user.id);
            }
          } else {
            setDebugStatus(`Auth Error: ${response.error}`);
            setLoading(false);
          }
        }
      );
    } catch (e: any) {
      setDebugStatus(`Launch Error: ${e.message}`);
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-aurora-bg text-aurora-primary gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-aurora-muted font-mono">{debugStatus}</p>
        </div>
      );
    }

    if (!session) {
      // Safe access to redirect URL for display
      const isExtension = typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL;
      const displayRedirectUrl = isExtension ? chrome.identity.getRedirectURL() : window.location.origin;

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-aurora-bg p-6 space-y-4">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-aurora-primary to-aurora-secondary">Orbit</h1>
          <p className="text-aurora-muted text-center max-w-xs">Your personal time and social supportive assistant.</p>

          <button
            onClick={handleGoogleLogin}
            className="px-4 py-2 bg-white text-black font-medium rounded-md hover:bg-gray-100 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Enter Orbit with Google
          </button>

          {authUrl && (
            <div className="text-center space-y-2 animate-in fade-in">
              <p className="text-green-400 text-xs">Auth URL Ready</p>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-aurora-accent underline break-all hover:text-white"
              >
                Click here if popup didn't open
              </a>
            </div>
          )}

          <div className="text-xs text-aurora-muted/50 font-mono mt-8 text-center border-t border-white/10 pt-4 w-full">
            <p className="mb-2">Status: {debugStatus}</p>
            <div className="flex justify-center gap-4 mb-2">
              <div className="text-[10px]">
                <span className="opacity-50">Session:</span> {session ? 'Active' : 'None'}
              </div>
              <div className="text-[10px]">
                <span className="opacity-50">Token:</span> {session && (session as any).provider_token ? 'Present' : 'Missing'}
              </div>
            </div>

            <button
              onClick={async () => {
                setDebugStatus('Reading storage...');
                // Force a check of storage directly first
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                  // Check persistent storage first
                  const result = await chrome.storage.local.get(['orbit_provider_token', 'auth_tokens']);
                  console.log('[App] Force refresh storage check:', result);

                  const { data: { session: newSession } } = await supabase.auth.getSession();
                  let currentSession = newSession as any;

                  // Use persistent token if available, else check temp tokens
                  const tokenToRestore = result.orbit_provider_token || (result.auth_tokens as any)?.provider_token;

                  if (tokenToRestore) {
                    if (currentSession) {
                      currentSession = { ...currentSession, provider_token: tokenToRestore };
                    }
                    setDebugStatus('Token FOUND (Persistent) and restored.');

                    // Ensure it's persisted if we found it in temp
                    if (!result.orbit_provider_token && tokenToRestore) {
                      await chrome.storage.local.set({ orbit_provider_token: tokenToRestore });
                    }
                  } else {
                    setDebugStatus('Token MISSING from storage.');
                  }

                  setSession(currentSession);
                  if (currentSession) checkProfile(currentSession.user.id);
                } else {
                  await consumeStoredTokens(); // Fallback
                }
              }}
              className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors text-aurora-muted hover:text-white"
            >
              Force Refresh Connection
            </button>

            <p className="mt-2 text-[10px] break-all max-w-xs mx-auto text-yellow-400 opacity-50 hover:opacity-100 transition-opacity">
              Redirect URL: {displayRedirectUrl}
            </p>
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-[9px] opacity-70 mb-1">Last Debug:</p>
              <button
                onClick={async () => {
                  const result = await chrome.storage.local.get(['last_callback_url']);
                  if (result.last_callback_url) {
                    console.log('Last Callback URL:', result.last_callback_url);
                    alert('Logged URL to console. Check DevTools.');
                  } else {
                    alert('No callback URL recorded yet.');
                  }
                }}
                className="text-[9px] bg-white/5 px-2 py-1 rounded"
              >
                Log Raw URL to Console
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!hasProfile && !showSettings) {
      return <Onboarding onComplete={() => setHasProfile(true)} />;
    }

    const renderActiveView = () => {
      switch (activeTab) {
        case 'home':
          return <Home session={session} onConnectCalendar={handleGoogleLogin} />;
        case 'chat':
          return <Chat session={session} />;
        case 'focus':
          return <Focus />;
      }
    };

    return (
      <Layout
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setShowSettings(false);
        }}
        onProfileClick={() => setShowSettings(true)}
      >
        {showSettings ? (
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-aurora-primary hover:text-aurora-accent">Close</button>
            </div>
            <Onboarding onComplete={() => setShowSettings(false)} />

            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium mb-2 text-aurora-muted">Account</h3>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    await chrome.storage.local.remove(['orbit_provider_token', 'auth_tokens']);
                  }
                  setSession(null);
                  setShowSettings(false);
                }}
                className="w-full py-2 px-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                Sign Out
              </button>
            </div>

            <div className="mt-auto text-center text-xs text-aurora-muted p-4">
              v1.0.0 • Orbit
            </div>
          </div>
        ) : (
          renderActiveView()
        )}
      </Layout>
    );
  };

  return renderContent();
}

export default App;
