import type { SharePayload } from './types';
import { isKnownBrokenInAppBrowser } from './userAgent';

export type ShareOrchestratorOutcome =
  | { status: 'native_success'; method: 'native' }
  | { status: 'native_cancelled'; method: 'native' }
  | { status: 'native_failed'; method: 'native'; errorName?: string; errorMessage?: string }
  | { status: 'copy_success'; method: 'copy' }
  | { status: 'copy_failed'; method: 'copy' };

/**
 * Detect user-cancelled native share. We deliberately avoid locale-fragile
 * substring matching of `error.message`: AbortError is the spec-compliant
 * cancel signal, and some Safari versions surface user cancel as
 * NotAllowedError with an English-only "cancel" word — covered as a safety
 * net but not relied upon for non-English locales.
 */
function isUserAbortedShare(error: unknown): boolean {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') return true;
    if (error.name === 'NotAllowedError' && /cancel/i.test(error.message)) return true;
  }
  return false;
}

function describeShareError(error: unknown): { errorName?: string; errorMessage?: string } {
  if (error instanceof DOMException || error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: typeof error.message === 'string' ? error.message.slice(0, 200) : undefined,
    };
  }
  return {};
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;

  // execCommand fallback for insecure contexts and older browsers. iOS Safari
  // is the picky one here:
  //   - element must be in the viewport (off-screen `top:-9999px` won't select);
  //   - `readOnly` suppresses the on-screen keyboard;
  //   - `contentEditable=true` is required for `setSelectionRange` to actually
  //     highlight content on iOS;
  //   - font-size ≥16px prevents the auto-zoom on focus;
  //   - Range API + `setSelectionRange` is more reliable than bare `.select()`.
  let textarea: HTMLTextAreaElement | null = null;
  const previousSelection = (() => {
    if (typeof window === 'undefined' || !window.getSelection) return null;
    const sel = window.getSelection();
    return sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  })();

  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.contentEditable = 'true';
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;margin:0;opacity:0;pointer-events:none;font-size:16px;';
    document.body.appendChild(textarea);

    const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
    if (selection && typeof document.createRange === 'function') {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, text.length);
    } else {
      textarea.select();
    }

    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
    // Restore any pre-existing selection so we don't disturb the user's state.
    if (previousSelection && typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(previousSelection);
      }
    }
  }
}

export async function shareWithFallback(payload: SharePayload): Promise<ShareOrchestratorOutcome> {
  // Omit `title` entirely when missing rather than passing `undefined`.
  // Some `canShare` implementations are stricter about explicit-undefined
  // keys than missing ones, and Android share-targets that prefill the
  // title as an email subject look broken when the title is a placeholder.
  const data: ShareData = payload.title
    ? { title: payload.title, text: payload.text, url: payload.url }
    : { text: payload.text, url: payload.url };

  // Skip native share entirely inside known-broken in-app browsers
  // (Instagram, Facebook, TikTok, LinkedIn). Their `navigator.share` exists
  // but commonly fails or no-ops. canShare guards against Android Chrome /
  // IAB throwing TypeError on payloads they refuse. If `canShare` is missing
  // we trust `share`.
  const nativeSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    !isKnownBrokenInAppBrowser() &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(data));

  if (nativeSupported) {
    try {
      await navigator.share(data);
      return { status: 'native_success', method: 'native' };
    } catch (error) {
      if (isUserAbortedShare(error)) {
        return { status: 'native_cancelled', method: 'native' };
      }
      // Real failure (Permissions-Policy, IAB, etc.). Surface to the caller —
      // do NOT silently auto-copy and toast "Link copied!", which would lie
      // to the user about whether they actually shared.
      return { status: 'native_failed', method: 'native', ...describeShareError(error) };
    }
  }

  // Native share unsupported (or canShare rejected the payload): legitimate
  // fallback to clipboard with the combined text+url payload.
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
