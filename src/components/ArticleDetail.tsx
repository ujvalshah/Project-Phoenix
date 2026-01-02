/**
 * ============================================================================
 * ARTICLE DETAIL DRAWER: Analysis-First Media Rendering
 * ============================================================================
 * 
 * RENDERING ORDER (STRICT):
 * 1. Structured Markdown content (analysis text)
 * 2. Primary media embed (if exists)
 * 3. Supporting media section (images grid + videos/docs list)
 * 
 * PRINCIPLES:
 * - Analysis text ALWAYS precedes media
 * - Media never interrupts text flow
 * - Internal scroll only (no body scroll)
 * - No auto-play, no sticky media
 * 
 * MARKDOWN RENDERING PARITY FIX (Applied):
 * ============================================================================
 * This component now uses the EXACT same MarkdownRenderer as CardContent
 * (Nugget/News Card preview) to ensure rendering consistency.
 * 
 * What was fixed:
 * - Title: Previously rendered as plain text. Now uses MarkdownRenderer to
 *   support markdown links, inline formatting, and embedded markdown.
 * - Content: Previously had extensive className overrides that could interfere
 *   with MarkdownRenderer's component styles. Now uses the same configuration
 *   as CardContent (no prose prop, simplified className structure).
 * 
 * Renderer reused: MarkdownRenderer from @/components/MarkdownRenderer
 * - Uses react-markdown with remarkGfm for GitHub-flavored markdown
 * - Supports: links, tables, inline formatting (bold, italic, code), lists,
 *   blockquotes, headers, and all GFM features
 * 
 * Why ArticleDetail previously failed to render markdown:
 * 1. Title was plain text - no markdown parsing at all
 * 2. Content had className overrides that could conflict with MarkdownRenderer's
 *    internal component styles (e.g., [&_a]:text-primary-600 overriding link styles)
 * 3. Both title and content now use identical MarkdownRenderer configuration
 *    as CardContent, ensuring perfect parity
 * 
 * No global behavior or unrelated components were altered - only ArticleDetail
 * drawer was updated to reuse the existing MarkdownRenderer.
 * 
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { Article } from '@/types';
import { X, Clock, ExternalLink, FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { formatDate, formatReadTime } from '@/utils/formatters';
import { Avatar } from './shared/Avatar';
import { AddToCollectionModal } from './AddToCollectionModal';
import { ShareMenu } from './shared/ShareMenu';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EmbeddedMedia } from './embeds/EmbeddedMedia';
import { SupportingMediaSection } from './shared/SupportingMediaSection';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/hooks/useAuth';
import { ReportModal } from './ReportModal';
import { classifyArticleMedia } from '@/utils/mediaClassifier';

interface ArticleDetailProps {
  article: Article;
  onClose?: () => void;
  isModal?: boolean;
  constrainWidth?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
}

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, 
  onClose, 
  isModal = false,
  constrainWidth = true,
  onEdit,
  onDelete,
  onToggleVisibility,
}) => {
  // Early return if article is not available
  if (!article) {
    // eslint-disable-next-line no-console
    console.warn('[ArticleDetail] Article is not available');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Article not available</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionMode, setCollectionMode] = useState<'public' | 'private'>('public');
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { withAuth } = useRequireAuth();
  const { currentUser, isAdmin } = useAuth();
  
  // Null-safe author access with defensive checks
  const authorName = article?.author?.name ?? "Unknown";
  const authorId = article?.author?.id ?? "";
  const isOwner = currentUser?.id === authorId;
  
  // Classify media into primary and supporting (safe with null checks)
  const { primaryMedia, supportingMedia } = classifyArticleMedia(article);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddToCollection = () => {
      setCollectionMode('public');
      setIsCollectionModalOpen(true);
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Root container: Apply width constraints when not in modal mode
  // When constrainWidth = true (desktop right-pane), enforce max-width and center alignment
  // When constrainWidth = false (mobile bottom sheet), do not cap width
  const rootContainerClasses = isModal 
    ? 'bg-white dark:bg-slate-950 min-h-full flex flex-col'
    : constrainWidth
      ? 'bg-white dark:bg-slate-950 min-h-full flex flex-col w-full max-w-[720px] mx-auto px-4 py-6 xl:px-6'
      : 'bg-white dark:bg-slate-950 min-h-full flex flex-col w-full px-4 py-6 xl:px-6';

  return (
    <div className={rootContainerClasses}>
       {/* Header / Nav */}
       {isModal && (
           <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-3">
                   <Avatar name={authorName} size="sm" />
                   <div className="text-sm font-bold text-slate-900 dark:text-white">{authorName}</div>
               </div>
               <div className="flex items-center gap-2">
                   <ShareMenu 
                       data={{ type: 'nugget', id: article?.id ?? '', title: article?.title ?? 'Untitled', shareUrl: window.location.href }} 
                       className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                   />
                   <button 
                       onClick={withAuth(handleAddToCollection)} 
                       className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                       title="Add to Collection"
                   >
                       <FolderPlus size={20} />
                   </button>
                   <div className="relative" ref={menuRef}>
                       <button 
                           onClick={handleToggleMenu}
                           className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                           title="More options"
                       >
                           <MoreVertical size={20} />
                       </button>
                       {showMenu && (
                           <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 overflow-hidden">
                               {(isOwner || isAdmin) && onEdit && (
                                   <button
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           setShowMenu(false);
                                           onEdit();
                                       }}
                                       className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                   >
                                       <Edit2 size={12} /> Edit
                                   </button>
                               )}

                               {isOwner && onToggleVisibility && (
                                   <button
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           setShowMenu(false);
                                           onToggleVisibility();
                                       }}
                                       className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                   >
                                       {(article?.visibility ?? 'public') === 'private' ? (
                                           <>
                                               <Globe size={12} className="text-blue-500" /> Make Public
                                           </>
                                       ) : (
                                           <>
                                               <Lock size={12} className="text-amber-500" /> Make Private
                                           </>
                                       )}
                                   </button>
                               )}

                               <button
                                   onClick={(e) => {
                                       e.stopPropagation();
                                       setShowMenu(false);
                                       setShowReportModal(true);
                                   }}
                                   className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                               >
                                   <Flag size={12} /> Report
                               </button>

                               {(isOwner || isAdmin) && onDelete && (
                                   <button
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           setShowMenu(false);
                                           onDelete();
                                       }}
                                       className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                   >
                                       <Trash2 size={12} /> Delete
                                   </button>
                               )}
                           </div>
                       )}
                   </div>
                   <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                       <X size={20} className="text-slate-500" />
                   </button>
               </div>
           </div>
       )}

       {/* Content Container
           Scroll behavior: In modal mode, ArticleModal handles scrolling.
           In standalone mode, this container provides scrolling. */}
       <div className={isModal ? "flex-1" : "flex-1 overflow-y-auto custom-scrollbar"}>
           <div className={`${isModal ? "max-w-none px-5 py-6" : "w-full px-0"} space-y-6`}>
               {/* Title & Meta */}
               <div>
                   {/* Categories - Matches card styling */}
                   {article?.categories && article.categories.length > 0 && (
                       <div className="flex flex-wrap gap-1 mb-3">
                           {article.categories.map(cat => (
                               <span key={cat} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                   {cat}
                               </span>
                           ))}
                       </div>
                   )}
                   
                   {/* Title - RENDERING PARITY FIX: Uses MarkdownRenderer to match CardContent behavior.
                       This ensures markdown links, inline formatting, and embedded markdown render
                       correctly in both preview and full view. Uses div with heading role for
                       accessibility while allowing MarkdownRenderer to handle all markdown parsing. */}
                   {article?.title && (
                       <div 
                           role="heading" 
                           aria-level={1}
                           className="text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-3"
                       >
                           <MarkdownRenderer content={article.title} />
                       </div>
                   )}
                   
                   {/* Meta Information */}
                   <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                       <div className="flex items-center gap-1.5">
                           <Clock size={14} />
                           <span>{formatReadTime(article?.readTime ?? 1)}</span>
                       </div>
                       {article?.publishedAt && (
                           <div>{formatDate(article.publishedAt)}</div>
                       )}
                   </div>
               </div>

              {/* Content - RENDERING PARITY FIX: Uses exact same MarkdownRenderer configuration
                  as CardContent (no prose prop, same className structure). Removed extensive
                  className overrides that could interfere with MarkdownRenderer's component styles.
                  This ensures GitHub-style markdown (links, tables, inline formatting) renders
                  identically to the card preview. */}
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <MarkdownRenderer content={article?.content ?? article?.excerpt ?? ''} />
              </div>

               {/* Primary Media Embed */}
               {primaryMedia && (
                   <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                       <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                           Primary Source
                       </div>
                       <div 
                           className="w-full bg-slate-100 dark:bg-slate-900 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                           style={{
                               aspectRatio: primaryMedia.type === 'youtube' ? '16/9' : 
                                           primaryMedia.type === 'image' ? (primaryMedia.aspect_ratio || '4/3') :
                                           undefined
                           }}
                           onClick={(e) => {
                               e.stopPropagation();
                               const linkUrl = primaryMedia.previewMetadata?.url || primaryMedia.url;
                               if (linkUrl) {
                                   window.open(linkUrl, '_blank', 'noopener,noreferrer');
                               }
                           }}
                       >
                           <EmbeddedMedia 
                               media={{
                                   type: primaryMedia.type,
                                   url: primaryMedia.url,
                                   thumbnail_url: primaryMedia.thumbnail,
                                   aspect_ratio: primaryMedia.aspect_ratio,
                                   previewMetadata: primaryMedia.previewMetadata,
                               }} 
                           />
                       </div>
                   </div>
               )}

               {/* Supporting Media */}
               {supportingMedia && supportingMedia.length > 0 && (
                   <SupportingMediaSection 
                       supportingMedia={supportingMedia}
                       className="pt-5"
                   />
               )}

               {/* Link Source */}
               {article?.source_type === 'link' && !primaryMedia && (article?.media?.url || (article as any)?.url) && (
                   <a 
                       href={article?.media?.url || (article as any)?.url || '#'} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                   >
                       <ExternalLink size={14} className="group-hover:text-primary-500 transition-colors" />
                       <span className="text-xs font-semibold truncate flex-1">Read original source</span>
                   </a>
               )}
           </div>
       </div>

      <AddToCollectionModal 
          isOpen={isCollectionModalOpen} 
          onClose={() => setIsCollectionModalOpen(false)} 
          articleIds={[article?.id ?? '']} 
          mode={collectionMode} 
      />

      <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetId={article?.id ?? ''}
          targetType="nugget"
      />
    </div>
  );
};


