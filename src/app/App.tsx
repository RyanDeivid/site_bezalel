import { useState, type ReactNode } from 'react';
import { RouterProvider } from 'react-router/dom';
import { ToastProvider } from '@/components/ui/Toast';
import { ServicesProvider } from '@/services/ServicesProvider';
import { PreferencesProvider } from './PreferencesProvider';
import { createAppRouter } from './router';

/** Provedores comuns ao navegador e à pré-renderização (entry-server.tsx). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <ServicesProvider>
        <ToastProvider>{children}</ToastProvider>
      </ServicesProvider>
    </PreferencesProvider>
  );
}

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
