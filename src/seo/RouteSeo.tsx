import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { absoluteUrl, resolvePublicRouteSeo, SITE_NAME } from './publicRouteSeo';

declare global {
  interface Window {
    plausible?: {
      (eventName: string, options?: { u?: string; props?: Record<string, string | number | boolean> }): void;
      q?: unknown[];
    };
  }
}

function upsertMeta(selector: string, attrs: Record<string, string>): HTMLMetaElement {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    document.head.appendChild(meta);
  }
  Object.entries(attrs).forEach(([key, value]) => meta?.setAttribute(key, value));
  return meta;
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function PublicRouteSeo(): null {
  const location = useLocation();

  useEffect(() => {
    const seo = resolvePublicRouteSeo(location.pathname);
    const canonicalUrl = absoluteUrl(seo.canonicalPath);

    document.title = seo.title;
    upsertCanonical(canonicalUrl);
    upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: `${SITE_NAME}: The Knowledge App` });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });

    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"][data-route-seo="true"]');
    if (seo.noindex) {
      upsertMeta('meta[name="robots"][data-route-seo="true"]', {
        name: 'robots',
        content: 'noindex, nofollow',
        'data-route-seo': 'true',
      });
    } else if (robots) {
      robots.remove();
    }
  }, [location.pathname]);

  return null;
}

export function PlausibleRouteTracker(): null {
  const location = useLocation();
  const didTrackInitialPageview = useRef(false);

  useEffect(() => {
    if (!didTrackInitialPageview.current) {
      didTrackInitialPageview.current = true;
      return;
    }
    const pageUrl = `${window.location.origin}${location.pathname}${location.search}`;
    window.plausible?.('pageview', { u: pageUrl });
  }, [location.pathname, location.search]);

  return null;
}
