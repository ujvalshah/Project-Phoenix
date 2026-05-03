import { forwardRef, memo, Suspense, useMemo } from 'react';
import { Article } from '@/types';
import { useNewsCard } from '@/hooks/useNewsCard';
import { GridVariant } from './card/variants/GridVariant';
import { FeedVariant } from './card/variants/FeedVariant';
import { MasonryVariant } from './card/variants/MasonryVariant';
import { CollectionPopover } from './CollectionPopover';
import { ReportModal, ReportPayload } from './ReportModal';
import { ArticleModal } from './ArticleModal';
import { ImageLightbox } from './ImageLightbox';
import { ArticleDetailLazy, ArticleDetailSidebarFallback } from '@/components/ArticleDetailLazy';
import { CreateNuggetModalLoadable } from './CreateNuggetModalLoadable';
import { LinkPreviewModal } from './LinkPreviewModal';
import { useToast } from '@/hooks/useToast';
import { adminModerationService } from '@/admin/services/adminModerationService';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import {
  buildLightboxSourceLinksForImageUrls,
  type MasonrySourceLink,
} from '@/utils/masonryMediaHelper';
import { getAllImageUrls } from '@/utils/mediaClassifier';
import { recordNewsCardMemoMismatch, recordNewsCardRender } from '@/utils/devFeedCloseAnalysis';

interface NewsCardProps {
  article: Article;
  /** Set when `article` was produced by `prepareArticleForNewsCard` (feed grid path). */
  skipArticlePrepare?: boolean;
  viewMode: 'grid' | 'feed' | 'masonry';
  onTagClick?: (tag: string) => void;
  onCategoryClick: (category: string) => void;
  onClick: (article: Article) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  currentUserId?: string;
  isPreview?: boolean;
  // Selection Props
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // Drawer Props
  disableInlineExpansion?: boolean;
  /** Committed search query for title highlighting on results cards */
  searchHighlightQuery?: string;
  /** First-viewport grid tile — LCP-oriented thumbnail scheduling (ArticleGrid). */
  priorityThumbnail?: boolean;
}

/** TEMP dev: first unequal prop name for memo mismatch logging (delete with devFeedCloseAnalysis). */
function getFirstNewsCardPropsMismatch(
  prev: NewsCardProps,
  next: NewsCardProps,
): keyof NewsCardProps | null {
  if (prev.article !== next.article) return 'article';
  if (prev.skipArticlePrepare !== next.skipArticlePrepare) return 'skipArticlePrepare';
  if (prev.viewMode !== next.viewMode) return 'viewMode';
  if (prev.onCategoryClick !== next.onCategoryClick) return 'onCategoryClick';
  if (prev.onClick !== next.onClick) return 'onClick';
  if (prev.expanded !== next.expanded) return 'expanded';
  if (prev.onToggleExpand !== next.onToggleExpand) return 'onToggleExpand';
  if (prev.currentUserId !== next.currentUserId) return 'currentUserId';
  if (prev.isPreview !== next.isPreview) return 'isPreview';
  if (prev.selectionMode !== next.selectionMode) return 'selectionMode';
  if (prev.isSelected !== next.isSelected) return 'isSelected';
  if (prev.onSelect !== next.onSelect) return 'onSelect';
  if (prev.onTagClick !== next.onTagClick) return 'onTagClick';
  if (prev.disableInlineExpansion !== next.disableInlineExpansion) return 'disableInlineExpansion';
  if (prev.searchHighlightQuery !== next.searchHighlightQuery) return 'searchHighlightQuery';
  if (prev.priorityThumbnail !== next.priorityThumbnail) return 'priorityThumbnail';
  return null;
}

function areNewsCardPropsEqual(prev: NewsCardProps, next: NewsCardProps): boolean {
  const mismatch = getFirstNewsCardPropsMismatch(prev, next);
  if (mismatch !== null) {
    if (import.meta.env.DEV) {
      recordNewsCardMemoMismatch(String(mismatch));
    }
    return false;
  }
  return true;
}

const NewsCardInner = forwardRef<HTMLDivElement, NewsCardProps>(
  (
    {
      article,
      skipArticlePrepare = false,
      viewMode,
      onCategoryClick,
      onClick,
      currentUserId,
      onTagClick,
      isPreview = false,
      selectionMode = false,
      isSelected = false,
      onSelect,
      disableInlineExpansion = false,
      searchHighlightQuery,
      priorityThumbnail = false,
    },
    ref,
  ) => {
    if (import.meta.env.DEV) {
      recordNewsCardRender();
    }

    const toast = useToast();
    const { currentUser } = useAuthSelector(
      (a) => ({ currentUser: a.user }),
      shallowEqualAuth,
    );

    const hookResult = useNewsCard({
      article,
      skipArticlePrepare,
      currentUserId,
      onCategoryClick,
      onTagClick,
      onClick,
      isPreview,
    });

    const { logic, modals, refs, article: originalArticle, isOwner, isAdmin } = hookResult;

    const { lightboxImageUrls, lightboxSourceLinksPerImage } = useMemo(() => {
      if (!modals.showLightbox) {
        return {
          lightboxImageUrls: [] as string[],
          lightboxSourceLinksPerImage: [] as Array<MasonrySourceLink | null>,
        };
      }
      const urls = getAllImageUrls(originalArticle);
      return {
        lightboxImageUrls: urls,
        lightboxSourceLinksPerImage: buildLightboxSourceLinksForImageUrls(originalArticle, urls),
      };
    }, [modals.showLightbox, originalArticle]);

    const gridSelectionHandler = useMemo(
      () => (onSelect ? () => onSelect(article.id) : undefined),
      [onSelect, article.id],
    );

    let variant;
    switch (viewMode) {
      case 'grid':
        variant = (
          <GridVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onSelect={gridSelectionHandler}
            disableInlineExpansion={disableInlineExpansion}
            searchHighlightQuery={searchHighlightQuery}
            priorityThumbnail={priorityThumbnail}
          />
        );
        break;
      case 'feed':
        variant = (
          <FeedVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
            searchHighlightQuery={searchHighlightQuery}
            priorityThumbnail={priorityThumbnail}
          />
        );
        break;
      case 'masonry':
        variant = (
          <MasonryVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
            searchHighlightQuery={searchHighlightQuery}
            priorityThumbnail={priorityThumbnail}
          />
        );
        break;
      default:
        variant = (
          <GridVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
            priorityThumbnail={priorityThumbnail}
          />
        );
    }

    return (
      <>
        <div ref={ref} id={logic.cardElementId || undefined} className="h-full w-full min-w-0">
          {variant}
        </div>

        {/* Modals: mount only when open — avoids N× hook/DOM subtrees across the feed (INP/memory). */}
        {modals.showCollection && (
          <CollectionPopover
            isOpen
            onClose={() => modals.setShowCollection(false)}
            articleId={originalArticle.id}
            mode={modals.collectionMode}
            anchorRect={modals.collectionAnchor}
          />
        )}
        {modals.showReport && (
          <ReportModal
            isOpen
            onClose={() => modals.setShowReport(false)}
            onSubmit={async (payload: ReportPayload) => {
              try {
                const normalizedComment = payload.comment?.trim() || undefined;

                await adminModerationService.submitReport(
                  payload.articleId,
                  'nugget',
                  payload.reason,
                  normalizedComment,
                  currentUser
                    ? {
                        id: currentUser.id,
                        name: currentUser.name,
                      }
                    : undefined,
                  originalArticle.author
                    ? {
                        id: originalArticle.author.id,
                        name: originalArticle.author.name,
                      }
                    : undefined,
                );
                toast.success('Report submitted successfully');
              } catch (error: unknown) {
                console.error('Failed to submit report:', error);

                let errorMessage: string;
                const status =
                  error &&
                  typeof error === 'object' &&
                  'response' in error &&
                  error.response &&
                  typeof error.response === 'object' &&
                  'status' in error.response &&
                  typeof (error.response as { status?: unknown }).status === 'number'
                    ? (error.response as { status: number }).status
                    : undefined;

                if (status === 400) {
                  errorMessage = 'Invalid report data. Please check your input.';
                } else if (status === 429) {
                  errorMessage = 'Too many reports. Please wait a moment before trying again.';
                } else if (status === 403) {
                  errorMessage = 'You do not have permission to submit this report.';
                } else if (status !== undefined && status >= 500) {
                  errorMessage = 'Server error. Please try again later.';
                } else {
                  errorMessage = 'Failed to submit report. Please try again.';
                }

                toast.error(errorMessage);
                throw error;
              }
            }}
            articleId={originalArticle.id}
          />
        )}
        {modals.showFullModal && (
          <ArticleModal
            isOpen={modals.showFullModal}
            onClose={() => modals.setShowFullModal(false)}
            article={originalArticle}
            onYouTubeTimestampClick={hookResult.logic.handlers.onYouTubeTimestampClick}
          />
        )}
        {modals.showLightbox && (
          <ImageLightbox
            isOpen
            onClose={(e) => {
              e?.stopPropagation?.();
              modals.setShowLightbox(false);
            }}
            images={lightboxImageUrls}
            initialIndex={modals.lightboxInitialIndex || 0}
            sourceLinksPerImage={lightboxSourceLinksPerImage}
            sidebarContent={
              <Suspense fallback={<ArticleDetailSidebarFallback />}>
                <ArticleDetailLazy
                  article={originalArticle}
                  isModal={false}
                  showHeader={true}
                  onClose={() => modals.setShowLightbox(false)}
                  onYouTubeTimestampClick={hookResult.logic.handlers.onYouTubeTimestampClick}
                />
              </Suspense>
            }
          />
        )}
        {modals.showEditModal && (
          <CreateNuggetModalLoadable
            isOpen
            onClose={() => modals.setShowEditModal(false)}
            mode="edit"
            initialData={originalArticle}
          />
        )}
        {modals.showDuplicateModal && (
          <CreateNuggetModalLoadable
            isOpen
            onClose={() => modals.setShowDuplicateModal(false)}
            mode="create"
            prefillData={originalArticle}
          />
        )}
        {modals.showLinkPreview && modals.linkPreviewUrl && (
          <LinkPreviewModal
            isOpen={modals.showLinkPreview}
            onClose={(e) => {
              e?.stopPropagation?.();
              modals.setShowLinkPreview(false);
              modals.setLinkPreviewUrl(null);
            }}
            url={modals.linkPreviewUrl}
            title={originalArticle.media?.previewMetadata?.title}
            description={originalArticle.media?.previewMetadata?.description}
            imageUrl={originalArticle.media?.previewMetadata?.imageUrl}
            domain={
              originalArticle.media?.previewMetadata?.url
                ? (() => {
                    try {
                      return new URL(originalArticle.media.previewMetadata.url).hostname.replace(
                        'www.',
                        '',
                      );
                    } catch {
                      return undefined;
                    }
                  })()
                : undefined
            }
          />
        )}
      </>
    );
  },
);

NewsCardInner.displayName = 'NewsCard';

export const NewsCard = memo(NewsCardInner, areNewsCardPropsEqual);
