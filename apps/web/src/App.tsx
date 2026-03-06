import { useEffect, useMemo, useState } from 'react';
import { CustomerPortal } from './CustomerPortal';
import { MarketingSite, getMarketingMetadata, normalizeSitePath } from './MarketingSite';
import { PortalApp } from './PortalApp';

function isPortalPath(path: string): boolean {
  return path === '/app' || path.startsWith('/app/');
}

function isPublicPortalPath(path: string): boolean {
  return path === '/portal' || path.startsWith('/portal/');
}

function upsertMeta(selector: string, attributeName: 'content', value: string): void {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  if (element) {
    element.setAttribute(attributeName, value);
    return;
  }

  const meta = document.createElement('meta');
  const selectorMatch = selector.match(/\[(name|property)="([^"]+)"\]/);
  if (!selectorMatch) {
    return;
  }

  meta.setAttribute(selectorMatch[1], selectorMatch[2]);
  meta.setAttribute(attributeName, value);
  document.head.appendChild(meta);
}

function upsertCanonical(url: string): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (existing) {
    existing.href = url;
    return;
  }

  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = url;
  document.head.appendChild(link);
}

function upsertStructuredData(data: Record<string, unknown>): void {
  const id = 'customervoice-structured-data';
  const existing = document.getElementById(id);
  const script = existing ?? document.createElement('script');

  script.id = id;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);

  if (!existing) {
    document.head.appendChild(script);
  }
}

function applyMetadata(rawPath: string): void {
  const origin = window.location.origin;

  if (isPortalPath(rawPath)) {
    const appUrl = `${origin}${rawPath}`;
    document.title = 'CustomerVoice App | Feedback Portal Workspace';
    upsertMeta('meta[name="description"]', 'content', 'CustomerVoice workspace for boards, ideas, moderation, analytics, and shipped notifications.');
    upsertMeta('meta[property="og:title"]', 'content', 'CustomerVoice App | Feedback Portal Workspace');
    upsertMeta('meta[property="og:description"]', 'content', 'CustomerVoice workspace for boards, ideas, moderation, analytics, and shipped notifications.');
    upsertMeta('meta[property="og:type"]', 'content', 'website');
    upsertMeta('meta[property="og:url"]', 'content', appUrl);
    upsertMeta('meta[name="twitter:title"]', 'content', 'CustomerVoice App | Feedback Portal Workspace');
    upsertMeta('meta[name="twitter:description"]', 'content', 'CustomerVoice workspace for boards, ideas, moderation, analytics, and shipped notifications.');
    upsertCanonical(appUrl);
    upsertStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'CustomerVoice App',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: appUrl,
    });
    return;
  }

  const normalizedPath = normalizeSitePath(rawPath);
  const metadata = getMarketingMetadata(normalizedPath, origin);
  const pageUrl = `${origin}${normalizedPath}`;

  document.title = metadata.title;
  upsertMeta('meta[name="description"]', 'content', metadata.description);
  upsertMeta('meta[property="og:title"]', 'content', metadata.title);
  upsertMeta('meta[property="og:description"]', 'content', metadata.description);
  upsertMeta('meta[property="og:type"]', 'content', metadata.ogType);
  upsertMeta('meta[property="og:url"]', 'content', pageUrl);
  upsertMeta('meta[name="twitter:title"]', 'content', metadata.title);
  upsertMeta('meta[name="twitter:description"]', 'content', metadata.description);
  upsertCanonical(pageUrl);
  upsertStructuredData(metadata.structuredData);
}

function currentPathname(): string {
  return window.location.pathname || '/';
}

export function App(): JSX.Element {
  const [rawPath, setRawPath] = useState<string>(currentPathname());

  useEffect(() => {
    function onPopState(): void {
      setRawPath(currentPathname());
    }

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    applyMetadata(rawPath);
  }, [rawPath]);

  const marketingPath = useMemo(() => normalizeSitePath(rawPath), [rawPath]);

  function navigate(path: string): void {
    const nextPath = isPortalPath(path) ? path : normalizeSitePath(path);

    if (nextPath === rawPath) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    window.history.pushState({}, '', nextPath);
    setRawPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  if (isPortalPath(rawPath)) {
    return <PortalApp path={rawPath} onNavigate={navigate} />;
  }

  if (isPublicPortalPath(rawPath)) {
    return <CustomerPortal path={rawPath} onNavigate={navigate} />;
  }

  return <MarketingSite path={marketingPath} onNavigate={navigate} />;
}
