import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/design-system';
import { App } from './App';
import './styles/globals.css';

let checkingForNewRelease = false;

window.addEventListener('vite:preloadError', async () => {
  if (checkingForNewRelease) return;

  const entrySelector = 'script[type="module"][src]';
  const currentEntry = document.querySelector<HTMLScriptElement>(entrySelector)?.src;
  if (!currentEntry) return;

  checkingForNewRelease = true;

  try {
    const reloadKey = `edu:release-reload:${currentEntry}`;
    if (sessionStorage.getItem(reloadKey)) return;

    const response = await fetch(window.location.href, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return;

    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextSrc = html.querySelector(entrySelector)?.getAttribute('src');
    if (!nextSrc || new URL(nextSrc, response.url).href === currentEntry) return;

    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  } catch {
    // The route error boundary remains available if the server cannot confirm a new release.
  } finally {
    checkingForNewRelease = false;
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

