import React from 'react';
import { Link } from 'react-router-dom';
import { useLegalPages } from '@/hooks/useLegalPages';

export const LegalFooter: React.FC = () => {
  const { footerPages, isLoading } = useLegalPages();

  // Don't render if loading or no pages to show
  if (isLoading || footerPages.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      aria-label="Legal"
      className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-auto print:hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Copyright */}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {currentYear} Nuggets. All rights reserved.
          </p>

          {/* Legal Links */}
          <nav aria-label="Legal pages" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {footerPages.map((page) => (
              <Link
                key={page.slug}
                to={`/legal/${page.slug}`}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              >
                {page.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
