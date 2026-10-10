import { useEffect } from 'react';
import { useT } from '@/app/preferences-context';
import { absoluteAssetUrl, absoluteUrl } from '@/lib/env';

interface MetaOptions {
  title: string;
  description?: string;
  /** Caminho da rota (sem base), usado no canonical e no og:url. */
  path?: string;
  /** Dados estruturados (JSON-LD). Use apenas com informações verificadas. */
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Atualiza título, descrição, canonical, Open Graph e JSON-LD em navegação
 * client-side. O build também gera HTML estático por rota com os mesmos
 * metadados (scripts/postbuild.ts), para robôs que não executam JavaScript.
 */
export function useDocumentMeta({ title, description, path, jsonLd, noindex }: MetaOptions) {
  const m = useT();
  useEffect(() => {
    const fullTitle = title === m.meta.home.title ? title : `${title} · ${m.meta.siteName}`;
    document.title = fullTitle;
    const desc = description ?? m.meta.defaultDescription;
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:image"]', 'property', 'og:image', absoluteAssetUrl('og-image.png'));
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex' : 'index, follow');

    if (path !== undefined) {
      const url = absoluteUrl(path);
      setMeta('meta[property="og:url"]', 'property', 'og:url', url);
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = url;
    }

    const existing = document.getElementById('bz-jsonld');
    existing?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'bz-jsonld';
      // JSON.stringify não escapa "<": evita fechar a tag script com dados externos.
      script.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
      document.head.appendChild(script);
    }
  }, [title, description, path, jsonLd, noindex, m]);
}
