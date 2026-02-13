// Background service worker for handling Chrome Identity auth flow.
// This runs independently of the popup, so it survives the popup closing on Mac.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_AUTH') {
    console.log('[background] Starting auth flow with URL:', message.url);

    chrome.identity.launchWebAuthFlow(
      { url: message.url, interactive: true },
      (callbackUrl) => {
        if (chrome.runtime.lastError || !callbackUrl) {
          const error = chrome.runtime.lastError?.message || 'No callback URL received';
          console.error('[background] Auth error:', error);
          chrome.storage.local.set({ auth_error: error });
          sendResponse({ success: false, error });
          return;
        }

        console.log('[background] Callback URL received:', callbackUrl);

        try {
          const url = new URL(callbackUrl);
          // Supabase may return tokens in hash fragment OR query params
          const hash = url.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          const queryParams = url.searchParams;

          const access_token = hashParams.get('access_token') || queryParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');

          console.log('[background] access_token found:', !!access_token);
          console.log('[background] refresh_token found:', !!refresh_token);

          if (!access_token) {
            // Log full URL parts to debug what Supabase returned
            console.log('[background] Hash:', hash);
            console.log('[background] Search:', url.search);
            console.log('[background] Full callback:', callbackUrl);
          }

          if (access_token) {
            // Also try to get provider_token
            const provider_token = hashParams.get('provider_token') || queryParams.get('provider_token');

            // DEBUG: Store the full callback URL to inspect what Supabase sent
            chrome.storage.local.set({
              auth_tokens: { access_token, refresh_token: refresh_token || '', provider_token },
              last_callback_url: callbackUrl
            }, () => {
              console.log('[background] Tokens stored in chrome.storage.local');
              sendResponse({ success: true, access_token, refresh_token, provider_token });
            });
          } else {
            const error = 'No access_token in callback. URL: ' + callbackUrl;
            chrome.storage.local.set({ auth_error: error });
            sendResponse({ success: false, error });
          }
        } catch (e) {
          const error = 'Error parsing callback: ' + e.message;
          console.error('[background]', error);
          chrome.storage.local.set({ auth_error: error });
          sendResponse({ success: false, error });
        }
      }
    );

    return true;
  }
});
