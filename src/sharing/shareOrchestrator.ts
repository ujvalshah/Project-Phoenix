import type { SharePayload } from './types';

export type ShareOrchestratorOutcome =
  | { status: 'native_success'; method: 'native' }
  | { status: 'native_cancelled'; method: 'native' }
  | { status: 'copy_success'; method: 'copy' }
  | { status: 'copy_failed'; method: 'copy' };

function isLikelyUserCancelledShare(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('cancel') || msg.includes('aborted');
  }
  return false;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareWithFallback(payload: SharePayload): Promise<ShareOrchestratorOutcome> {
  const nativeSupported =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (nativeSupported) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return { status: 'native_success', method: 'native' };
    } catch (error) {
      if (isLikelyUserCancelledShare(error)) {
        return { status: 'native_cancelled', method: 'native' };
      }
    }
  }

  const copyPayload = [payload.text, payload.url].filter(Boolean).join('\n\n');
  const copied = await copyToClipboard(copyPayload);
  if (copied) {
    return { status: 'copy_success', method: 'copy' };
  }

  return { status: 'copy_failed', method: 'copy' };
}

export async function copySharePayload(payload: SharePayload): Promise<boolean> {
  const copyPayload = [payload.text, payload.url].filter(Boolean).join('\n\n');
  return copyToClipboard(copyPayload);
}

