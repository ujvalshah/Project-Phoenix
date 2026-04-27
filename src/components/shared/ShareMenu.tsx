import React, { useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { emitShareTelemetry } from '@/observability/shareTelemetry';
import { buildBaseSharePayload } from '@/sharing/payloadBuilder';
import {
  buildLinkedInIntent,
  buildWhatsAppIntent,
  buildXIntent,
} from '@/sharing/platformTargets';
import { copySharePayload, shareWithFallback } from '@/sharing/shareOrchestrator';
import type { ShareContext, ShareItemData, ShareMeta } from '@/sharing/types';
import { DropdownPortal, type AnchoredOverlayHost } from '@/components/UI/DropdownPortal';

interface ShareMenuProps {
  data: ShareItemData;
  meta?: ShareMeta;
  className?: string;
  iconSize?: number;
  surface?: ShareContext['surface'];
  /**
   * Portal host for the dropdown panel. Use `modal` when the menu lives inside
   * a modal/drawer so it stacks above the modal body. Defaults to `dropdown`.
   */
  host?: Extract<AnchoredOverlayHost, 'dropdown' | 'modal'>;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({
  data,
  meta,
  className = '',
  iconSize = 14,
  surface = 'unknown',
  host = 'dropdown',
}) => {
  const toast = useToast();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const payload = useMemo(() => buildBaseSharePayload(data, meta), [data, meta]);
  const intents = useMemo(
    () => ({
      whatsapp: buildWhatsAppIntent(payload),
      x: buildXIntent(payload),
      linkedin: buildLinkedInIntent(payload),
    }),
    [payload],
  );

  const telemetryBase = {
    entityType: data.type,
    entityId: data.id,
    surface,
    shareUrl: data.shareUrl,
  } as const;

  const getDiagnosticUserAgent = (): string | undefined => {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return undefined;
    }
    return navigator.userAgent.slice(0, 256);
  };

  const handlePrimaryShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    emitShareTelemetry('share_attempted', {
      ...telemetryBase,
      platform: 'native',
      method: 'native',
    });
    const outcome = await shareWithFallback(payload);
    if (outcome.status === 'native_success') {
      emitShareTelemetry('share_native_success', {
        ...telemetryBase,
        platform: 'native',
        method: 'native',
      });
      toast.success('Shared');
      setIsOpen(false);
      return;
    }
    if (outcome.status === 'native_cancelled') {
      emitShareTelemetry('share_native_cancelled', {
        ...telemetryBase,
        platform: 'native',
        method: 'native',
      });
      toast.info('Share cancelled');
      setIsOpen(false);
      return;
    }
    if (outcome.status === 'native_failed') {
      // Surface, don't lie. Keep the menu open so the user can tap "Copy link"
      // (or a platform intent) directly without re-opening the share menu.
      emitShareTelemetry('share_native_failed', {
        ...telemetryBase,
        platform: 'native',
        method: 'native',
        userAgent: getDiagnosticUserAgent(),
        errorName: outcome.errorName,
        errorMessage: outcome.errorMessage,
      });
      toast.error('Share unavailable — try Copy link below');
      return;
    }
    if (outcome.status === 'copy_success') {
      emitShareTelemetry('share_copy_success', {
        ...telemetryBase,
        platform: 'copy',
        method: 'copy',
      });
      toast.success('Link copied!');
      setIsOpen(false);
      return;
    }
    emitShareTelemetry('share_copy_failed', {
      ...telemetryBase,
      platform: 'copy',
      method: 'copy',
      userAgent: getDiagnosticUserAgent(),
    });
    toast.error('Unable to share or copy link');
    setIsOpen(false);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    emitShareTelemetry('share_attempted', {
      ...telemetryBase,
      platform: 'copy',
      method: 'copy',
    });
    const copied = await copySharePayload(payload);
    if (copied) {
      emitShareTelemetry('share_copy_success', {
        ...telemetryBase,
        platform: 'copy',
        method: 'copy',
      });
      toast.success('Link copied!');
    } else {
      emitShareTelemetry('share_copy_failed', {
        ...telemetryBase,
        platform: 'copy',
        method: 'copy',
        userAgent: getDiagnosticUserAgent(),
      });
      toast.error('Unable to copy link');
    }
    setIsOpen(false);
  };

  const handlePlatformClick = (
    e: React.MouseEvent,
    platform: 'whatsapp' | 'x' | 'linkedin',
    targetUrl: string,
  ) => {
    e.stopPropagation();
    emitShareTelemetry('share_platform_click', {
      ...telemetryBase,
      platform,
      method: 'platform_intent',
    });
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        emitShareTelemetry('share_opened', {
          ...telemetryBase,
          platform: 'system',
          method: 'system',
        });
      }
      return next;
    });
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggleMenu}
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all hover:scale-105 active:scale-95 ${className}`}
        title="Share"
        aria-label="Share"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Share2 size={iconSize || 18} strokeWidth={1.5} />
      </button>
      <DropdownPortal
        isOpen={isOpen}
        anchorRef={anchorRef}
        align="right"
        offsetY={8}
        host={host}
        onClickOutside={() => setIsOpen(false)}
        className="min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div>
          <button type="button" onClick={handlePrimaryShare} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Share now
          </button>
          <button type="button" onClick={handleCopyLink} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Copy link
          </button>
          <button type="button" onClick={(e) => handlePlatformClick(e, 'whatsapp', intents.whatsapp)} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            WhatsApp
          </button>
          <button type="button" onClick={(e) => handlePlatformClick(e, 'x', intents.x)} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            X / Twitter
          </button>
          <button type="button" onClick={(e) => handlePlatformClick(e, 'linkedin', intents.linkedin)} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            LinkedIn
          </button>
        </div>
      </DropdownPortal>
    </>
  );
};
