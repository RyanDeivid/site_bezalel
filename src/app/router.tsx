import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RootLayout } from '@/components/layout/RootLayout';
import { RouteFallback } from '@/components/layout/RouteFallback';
import { HomePage } from '@/features/home/HomePage';
import { RouteError } from '@/features/pages/RouteError';

/**
 * Rotas da aplicação. A home é carregada junto com o bundle principal (é a
 * página de entrada mais comum); as demais são divididas em chunks e
 * baixadas sob demanda. O laboratório 3D tem ainda um segundo nível de
 * divisão: three.js só é baixado quando o visitante entra no modo 3D.
 */
const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => async () => {
  const mod = await loader();
  return { Component: mod.default };
};

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    // Exibido enquanto o chunk da rota inicial (quando preguiçosa) é baixado.
    hydrateFallbackElement: <RouteFallback />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', lazy: lazyPage(() => import('@/features/catalog/ExplorePage')) },
      { path: 'course/:slug', lazy: lazyPage(() => import('@/features/catalog/CourseDetailPage')) },
      { path: 'trail', lazy: lazyPage(() => import('@/features/tools/TrailPage')) },
      { path: 'skills', lazy: lazyPage(() => import('@/features/tools/ConstellationPage')) },
      { path: 'saved', lazy: lazyPage(() => import('@/features/tools/ShelfPage')) },
      { path: 'compare', lazy: lazyPage(() => import('@/features/tools/ComparePage')) },
      { path: 'insights', lazy: lazyPage(() => import('@/features/insights/InsightsPage')) },
      { path: 'agents', lazy: lazyPage(() => import('@/features/agents/AgentsPage')) },
      { path: 'lab', lazy: lazyPage(() => import('@/features/lab/LabPage')) },
      { path: 'universe', lazy: lazyPage(() => import('@/features/universe/UniversePage')) },
      { path: 'assistant', lazy: lazyPage(() => import('@/features/assistant/AssistantPage')) },
      { path: 'about', lazy: lazyPage(() => import('@/features/pages/AboutPage')) },
      { path: 'methodology', lazy: lazyPage(() => import('@/features/pages/MethodologyPage')) },
      { path: 'privacy', lazy: lazyPage(() => import('@/features/pages/PrivacyPage')) },
      { path: 'terms', lazy: lazyPage(() => import('@/features/pages/TermsPage')) },
      { path: '*', lazy: lazyPage(() => import('@/features/pages/NotFoundPage')) },
    ],
  },
];

export function createAppRouter() {
  // BASE_URL vem do Vite ("/" localmente, "/site_bezalel/" no GitHub Pages).
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
  return createBrowserRouter(routes, { basename });
}
