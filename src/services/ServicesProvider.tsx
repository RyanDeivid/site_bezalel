import { useState, type ReactNode } from 'react';
import { ServicesContext } from './context';
import { createServices } from './index';
import type { Services } from './types';

export function ServicesProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const [value] = useState<Services>(() => services ?? createServices());
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
