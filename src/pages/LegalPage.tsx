import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Loader2, FileWarning } from 'lucide-react';
import { useLegalPageFull } from '@/hooks/useLegalPages';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export const LegalPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = useLegalPageFull(slug);

  useDocumentMeta({
    title: page?.title,
    description: page?.description,
    noindex: page?.noindex,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary-500" />
      </div>
    );
  }

  // Page not found or disabled
  if (!page || !page.enabled) {
    return <Navigate to="/" replace />;
  }

  // Content missing
  if (error || !page.content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <FileWarning className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Content Unavailable
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            The content for this page could not be loaded. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return <LegalPageLayout config={page} content={page.content} />;
};

export default LegalPage;
