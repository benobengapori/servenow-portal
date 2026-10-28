'use client';

import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DISMISS_KEY = 'sn-install-dismissed';

/** Chrome/Edge/Samsung fire this before showing their own install UI. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'hidden' | 'android' | 'ios';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Registers the service worker and offers installation:
 *  - Android/desktop Chrome: an "Install" button that opens the browser's install dialog.
 *  - iPhone/iPad Safari: instructions, since iOS has no install API (Share → Add to Home Screen).
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {
        /* offline support is optional */
      });
    }
    if (isStandalone() || wasDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
    };
    const onInstalled = () => setMode('hidden');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIosSafari()) setMode('ios');
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setMode('hidden');
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setMode('hidden');
    setDeferred(null);
  };

  if (mode === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-label="Install ServeNow"
      className="pop fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-line bg-surface p-3 shadow-panel"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE}/icons/icon-192.png`} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="font-semibold">Install ServeNow</div>
        {mode === 'android' ? (
          <div className="text-muted">Add it to your home screen. It opens full screen like an app.</div>
        ) : (
          <div className="text-muted">
            Tap <ShareGlyph /> <span className="font-medium text-fg">Share</span>, then <span className="font-medium text-fg">Add to Home Screen</span>.
          </div>
        )}
        <div className="mt-2 flex gap-2">
          {mode === 'android' ? (
            <button type="button" className="btn btn-primary px-3 py-1.5 text-[13px]" onClick={() => void install()}>
              Install
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-[13px]" onClick={dismiss}>
            {mode === 'android' ? 'Not now' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 -translate-y-px align-middle text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
