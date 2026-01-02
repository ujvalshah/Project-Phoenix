
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminConfigService } from '@/admin/services/adminConfigService';
import { LegalPage } from '@/types/legal';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Loader2, ArrowLeft, Clock } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

export const LegalPageRenderer: React.FC = () => {
  // Use a catch-all route param if possible, or specific slug
  const params = useParams();
  const path = window.location.hash.split('/')[1]; // Fallback if routing structure varies
  const slug = params.slug || path;
  
  const navigate = useNavigate();
  const [page, setPage] = useState<LegalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminConfigService.getLegalPage(slug);
            if (!data || !data.isEnabled) {
                setError("Page not found");
            } else {
                setPage(data);
                document.title = `${data.title} | Nuggets`;
            }
        } catch (e) {
            setError("Error loading content");
        } finally {
            setLoading(false);
        }
    };
    load();
  }, [slug]);

  if (loading) {
      return (
          <div className="min-h-[60vh] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
          </div>
      );
  }

  if (error || !page) {
      return (
          <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">404</h1>
              <p className="text-slate-500 mb-6">{error || "Page not found"}</p>
              <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold">Go Home</button>
          </div>
      );
  }

  return (
    <div className="py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
            
            {/* Back Link */}
            <button 
                onClick={() => navigate(-1)} 
                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft size={16} /> Back
            </button>

            {/* Glass Card */}
            <article className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 sm:p-12 shadow-sm">
                
                {/* Meta Header */}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800/50">
                    <Clock size={14} />
                    Last Updated: {formatDate(page.lastUpdated)}
                </div>

                {/* Content */}
                <div className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary-600">
                    <MarkdownRenderer content={page.content} prose />
                </div>

            </article>
        </div>
    </div>
  );
};
