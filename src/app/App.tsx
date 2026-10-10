import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { ToastProvider } from '@/components/ui/Toast';
import { ServicesProvider } from '@/services/ServicesProvider';
import { PreferencesProvider } from './PreferencesProvider';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <PreferencesProvider>
      <ServicesProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ServicesProvider>
    </PreferencesProvider>
  );
}
