import React, { useState, useEffect } from 'react';
import { Article } from '@/types';
import { apiClient } from '@/services/apiClient';
import { buildFeedImageResponsiveProps } from '@/utils/feedImageResponsive';
import { Loader2, FileText, User, Layers, ExternalLink } from 'lucide-react';
import { formatDate } from '@/utils/formatters';
import { getErrorMessage, isRequestCancelled } from '../utils/adminTypeGuards';

interface ReportContentPreviewProps {
  targetId: string;
  targetType: 'nugget' | 'user' | 'collection';
}

interface ModerationCollectionContent {
  name?: string;
  description?: string;
  validEntriesCount?: number;
  entries?: unknown[];
  createdAt?: string;
}

interface ModerationUserContent {
  profile?: {
    avatarUrl?: string;
    displayName?: string;
    username?: string;
  };
  auth?: {
    email?: string;
  };
}

interface ModerationContentResponse {
  content: unknown;
  exists: boolean;
  deleted: boolean;
  targetType: string;
  targetId: string;
}

type PreviewContent =
  | { targetType: 'nugget'; content: Article }
  | { targetType: 'collection'; content: ModerationCollectionContent }
  | { targetType: 'user'; content: ModerationUserContent };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isArticleContent(value: unknown): value is Article {
  return isRecord(value) && typeof value.content === 'string' && 'author' in value;
}

function isModerationCollectionContent(value: unknown): value is ModerationCollectionContent {
  return isRecord(value);
}

function isModerationUserContent(value: unknown): value is ModerationUserContent {
  return isRecord(value);
}

export const ReportContentPreview: React.FC<ReportContentPreviewProps> = ({ targetId, targetType }) => {
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Use moderation-specific endpoint that can fetch deleted content
        // This endpoint is admin-only and bypasses normal visibility filters
        // Use unique cancelKey to prevent interference with other requests
        const cancelKey = `reportContentPreview.${targetType}.${targetId}`;
        const response = await apiClient.get<ModerationContentResponse>(
          `/moderation/content/${targetType}/${targetId}`,
          {},
          cancelKey,
        );
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        if (response.exists && response.content) {
          // Handle different content types
          if (targetType === 'nugget') {
            if (isArticleContent(response.content)) {
              setPreviewContent({ targetType: 'nugget', content: response.content });
            } else {
              setError('Nugget content is unavailable.');
            }
          } else if (targetType === 'collection') {
            if (isModerationCollectionContent(response.content)) {
              setPreviewContent({
                targetType: 'collection',
                content: response.content,
              });
            } else {
              setError('Collection content is unavailable.');
            }
          } else {
            if (isModerationUserContent(response.content)) {
              setPreviewContent({
                targetType: 'user',
                content: response.content,
              });
            } else {
              setError('User content is unavailable.');
            }
          }
        } else {
          // Content doesn't exist or was deleted
          setError(response.deleted 
            ? `This ${targetType} was deleted and is no longer available.`
            : 'Content not found'
          );
        }
      } catch (e: unknown) {
        // Don't update state if component is unmounted
        if (!isMounted) return;
        
        // Ignore cancellation errors - these are expected when component unmounts or re-renders
        if (isRequestCancelled(e)) {
          // Silently ignore cancelled requests - don't update state
          setIsLoading(false);
          return;
        }

        const responseData = isRecord(e) && isRecord(e.response) && isRecord(e.response.data)
          ? e.response.data
          : null;
        const status = isRecord(e) && isRecord(e.response) && typeof e.response.status === 'number'
          ? e.response.status
          : undefined;
        const responseMessage =
          responseData && typeof responseData.message === 'string' ? responseData.message : '';
        const wasDeleted =
          responseData && typeof responseData.deleted === 'boolean' ? responseData.deleted : false;
        
        // Handle 404 specifically - content was deleted or doesn't exist
        if (
          status === 404 ||
          wasDeleted ||
          responseMessage.includes('deleted') ||
          responseMessage.includes('not found')
        ) {
          setError(`This ${targetType} was deleted and is no longer available.`);
          setIsLoading(false);
          return;
        }
        
        // Handle 403 - admin access required (shouldn't happen if user is admin, but handle gracefully)
        if (status === 403) {
          setError('Admin access required to view reported content.');
          setIsLoading(false);
          return;
        }
        
        // Handle other errors
        const message = getErrorMessage(e, '');
        if (responseMessage) {
          setError(responseMessage);
        } else if (message) {
          setError(message);
        } else {
          setError(`Failed to load ${targetType} content. The resource may have been deleted.`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchContent();
    
    // Cleanup: mark component as unmounted
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {error || 'The requested resource was not found.'}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          This content may have been deleted. The report will still be available for review.
        </p>
      </div>
    );
  }

  if (!previewContent) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="text-sm text-slate-500">Content not found</p>
      </div>
    );
  }

  // Render based on target type
  if (previewContent.targetType === 'nugget') {
    const article = previewContent.content;
    const previewUrl = article.media?.previewMetadata?.imageUrl;
    const previewResponsive = previewUrl ? buildFeedImageResponsiveProps(previewUrl) : null;
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          {previewResponsive && (
            <img
              src={previewResponsive.src}
              srcSet={previewResponsive.srcSet}
              sizes="80px"
              width={80}
              height={80}
              alt={article.title}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              decoding="async"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-slate-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                {article.title || 'Untitled Nugget'}
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
              {article.excerpt || article.content?.substring(0, 150)}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>By {article.author?.name || 'Unknown'}</span>
              {article.publishedAt && (
                <span>{formatDate(article.publishedAt, true)}</span>
              )}
            </div>
          </div>
        </div>
        {article.media?.url && (
          <a 
            href={article.media.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            View Source <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  if (previewContent.targetType === 'collection') {
    const content = previewContent.content;
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-slate-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {content.name || 'Unnamed Collection'}
          </h4>
        </div>
        {content.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
            {content.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{(content.validEntriesCount ?? content.entries?.length) || 0} items</span>
          {content.createdAt && (
            <span>{formatDate(content.createdAt, true)}</span>
          )}
        </div>
      </div>
    );
  }

  if (previewContent.targetType === 'user') {
    const content = previewContent.content;
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <div className="flex items-center gap-3">
          {content.profile?.avatarUrl && (
            <img 
              src={content.profile.avatarUrl} 
              alt={content.profile.displayName}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {content.profile?.displayName || content.auth?.email || 'Unknown User'}
              </h4>
            </div>
            {content.profile?.username && (
              <p className="text-xs text-slate-500">@{content.profile.username}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

