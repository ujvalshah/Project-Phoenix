import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import type { LegalPageConfig } from '@/services/legalService';

interface LegalPageLayoutProps {
  config: LegalPageConfig;
  content: string;
}

/** Generate a URL-safe slug from heading text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** Format an ISO date string for display */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Extract H2 headings from raw markdown for TOC */
function extractHeadings(markdown: string): Array<{ id: string; text: string }> {
  const headings: Array<{ id: string; text: string }> = [];
  const regex = /^## (.+)$/gm;
  let match = regex.exec(markdown);
  while (match !== null) {
    const text = match[1].trim();
    headings.push({ id: slugify(text), text });
    match = regex.exec(markdown);
  }
  return headings;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({ config, content }) => {
  const articleRef = useRef<HTMLDivElement>(null);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>('');
  const [tocOpen, setTocOpen] = useState(false);

  // After markdown renders, assign IDs to H2 elements for anchor scrolling
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;

    const h2Elements = container.querySelectorAll<HTMLElement>('.legal-content-body h2');
    h2Elements.forEach((h2) => {
      const text = h2.textContent?.trim();
      if (text) {
        h2.id = slugify(text);
        h2.style.scrollMarginTop = '6rem';
      }
    });
  }, [content]);

  // Track active heading with IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    // Slight delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      headings.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [headings]);

  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
      setActiveId(id);
      setTocOpen(false);
    }
  }, []);

  const hasToc = headings.length > 2;

  return (
    <div ref={articleRef} className="min-h-screen bg-white dark:bg-slate-950">
      <HeaderSpacer />

      {/* Page Header — full-width subtle background */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {config.title}
          </h1>
          {(config.lastUpdated || config.effectiveDate) && (
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
              {config.lastUpdated && (
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Last updated {formatDate(config.lastUpdated)}
                </span>
              )}
              {config.effectiveDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  Effective {formatDate(config.effectiveDate)}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar TOC + content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`${hasToc ? 'lg:grid lg:grid-cols-[220px_1fr] lg:gap-10' : ''} py-8 sm:py-10`}>

          {/* TOC Sidebar — sticky on desktop, collapsible on mobile */}
          {hasToc && (
            <aside className="print:hidden">
              {/* Mobile: collapsible */}
              <div className="lg:hidden mb-6">
                <button
                  onClick={() => setTocOpen(!tocOpen)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  On this page
                  <ChevronDown size={14} className={`transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
                </button>
                {tocOpen && (
                  <nav aria-label="Table of contents" className="mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <ul className="space-y-1">
                      {headings.map((heading) => (
                        <li key={heading.id}>
                          <a
                            href={`#${heading.id}`}
                            onClick={(e) => handleAnchorClick(e, heading.id)}
                            className={`block text-[13px] py-1 transition-colors ${
                              activeId === heading.id
                                ? 'text-primary-600 dark:text-primary-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            {heading.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>

              {/* Desktop: sticky sidebar */}
              <nav
                aria-label="Table of contents"
                className="hidden lg:block sticky top-24"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  On this page
                </p>
                <ul className="space-y-0.5 border-l border-slate-200 dark:border-slate-800">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        onClick={(e) => handleAnchorClick(e, heading.id)}
                        className={`block text-[13px] leading-snug py-1.5 pl-4 -ml-px border-l-2 transition-colors ${
                          activeId === heading.id
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-medium'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {/* Content */}
          <article role="article" aria-label={config.title} className="min-w-0">
            <div className="legal-content-body">
              <MarkdownRenderer content={content} prose />
            </div>

            {/* Print footer */}
            <footer className="hidden print:block mt-12 pt-6 border-t border-slate-300 text-sm text-slate-500">
              <p>
                {config.title}
                {config.lastUpdated && ` — Last updated ${formatDate(config.lastUpdated)}.`}
                {config.effectiveDate && ` Effective ${formatDate(config.effectiveDate)}.`}
              </p>
              <p className="mt-1">Nuggets — nuggetnews.app</p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
