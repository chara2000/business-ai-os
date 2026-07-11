'use client';

import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'business-os-pwa-dismiss';
const INSTALLED_KEY = 'business-os-pwa-installed';

export function usePwa() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) localStorage.setItem(INSTALLED_KEY, '1');

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
      localStorage.setItem(INSTALLED_KEY, '1');
    };
    window.addEventListener('appinstalled', onInstalled);

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        });
      } else {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          setSwReady(true);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          });
        })
        .catch(() => setSwReady(false));
      }
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    if (outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker?.ready.then((reg) => {
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
  }, []);

  const isDismissed = () => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(DISMISS_KEY) === '1';
  };

  const dismissBanner = () => localStorage.setItem(DISMISS_KEY, '1');

  const showInstallBanner =
    !isStandalone &&
    !isDismissed() &&
    (canInstall || (isIOS && !localStorage.getItem(INSTALLED_KEY)));

  return {
    isStandalone,
    isOnline,
    canInstall,
    isIOS,
    swReady,
    updateAvailable,
    showInstallBanner,
    install,
    applyUpdate,
    dismissBanner,
    openInBrowser: () => {
      window.open(window.location.href, '_blank');
    },
  };
}
