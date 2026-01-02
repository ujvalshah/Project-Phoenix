
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { adminConfigService } from '@/admin/services/adminConfigService';
import { LegalPage } from '@/types/legal';

export const LegalFooter: React.FC = () => {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    // In a real app, this might be passed via context or layout loader
    // to avoid fetching on every page load if footer re-renders
    const load = async () => {
        const all = await adminConfigService.getLegalPages();
        setPages(all.filter(p => p.isEnabled));
    };
    load();
  }, []);

  if (pages.length === 0) return null;

  return (
    <footer className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-auto">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Desktop View */}
        <div className="hidden md:flex h-14 items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <div>
                © {new Date().getFullYear()} Nuggets. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
                {pages.map(page => (
                    <Link 
                        key={page.id} 
                        to={`/${page.slug}`} 
                        className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                        {page.title}
                    </Link>
                ))}
            </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden py-4 border-t border-transparent">
            <button 
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
                <span>Legal & Information</span>
                {isMobileOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isMobileOpen ? 'max-h-64 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-3 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                    {pages.map(page => (
                        <Link 
                            key={page.id} 
                            to={`/${page.slug}`} 
                            className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary-600 transition-colors"
                        >
                            {page.title}
                        </Link>
                    ))}
                </div>
            </div>
            
            <div className="mt-4 text-[10px] text-slate-400 text-center">
                © {new Date().getFullYear()} Nuggets.
            </div>
        </div>

      </div>
    </footer>
  );
};
