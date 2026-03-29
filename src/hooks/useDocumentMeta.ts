import { useEffect } from 'react';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  noindex?: boolean;
}

/**
 * Sets document.title and meta tags. Cleans up on unmount.
 */
export function useDocumentMeta({ title, description, noindex }: DocumentMetaOptions): void {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = `${title} | Nuggets`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  useEffect(() => {
    if (!description) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const hadExisting = !!meta;
    const previousContent = meta?.content ?? '';

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;

    return () => {
      if (hadExisting && meta) {
        meta.content = previousContent;
      } else if (meta && meta.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, [description]);

  useEffect(() => {
    if (!noindex) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      if (meta.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, [noindex]);
}
