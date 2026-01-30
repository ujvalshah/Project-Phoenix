import React from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface ShareItemData {
  type: 'nugget' | 'collection';
  id: string;
  title?: string;
  shareUrl: string;
}

interface ShareMenuProps {
  data: ShareItemData;
  meta?: { text?: string; author?: string };
  className?: string;
  iconSize?: number;
}

/**
 * Build a pre-filled share message with title, author, excerpt, and URL.
 * This becomes the `text` body in the native share sheet (WhatsApp, etc.).
 */
function buildShareText(
  data: ShareItemData,
  meta?: { text?: string; author?: string },
): string {
  const parts: string[] = [];

  // Title line — bold-ish for WhatsApp (*title*)
  if (data.title) {
    const titleLine = meta?.author
      ? `${data.title} — by ${meta.author}`
      : data.title;
    parts.push(titleLine);
  }

  // Excerpt / description (truncated to keep message compact)
  if (meta?.text) {
    const excerpt =
      meta.text.length > 120 ? meta.text.slice(0, 117) + '…' : meta.text;
    parts.push('');
    parts.push(excerpt);
  }

  // Canonical URL always last — WhatsApp auto-unfurls the last URL
  parts.push('');
  parts.push(data.shareUrl);

  return parts.join('\n');
}

export const ShareMenu: React.FC<ShareMenuProps> = ({
  data,
  meta,
  className = '',
  iconSize = 14,
}) => {
  const toast = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareText = buildShareText(data, meta);

    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title || '',
          text: shareText,
          url: data.shareUrl,
        });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Link copied!');
      } catch {
        // Clipboard write failed — silent fallback
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all hover:scale-105 active:scale-95 ${className}`}
      title="Share"
    >
      <Share2 size={iconSize || 18} strokeWidth={1.5} />
    </button>
  );
};
