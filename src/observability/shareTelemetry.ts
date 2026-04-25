import { recordShareEvent } from './telemetry';

export const CANONICAL_URL_VERSION = 'v2';

export type ShareTelemetryEventName =
  | 'share_opened'
  | 'share_attempted'
  | 'share_native_success'
  | 'share_native_cancelled'
  | 'share_copy_success'
  | 'share_copy_failed'
  | 'share_platform_click';

export interface ShareTelemetryPayload {
  entityType: 'nugget' | 'collection';
  entityId: string;
  surface: string;
  platform: 'native' | 'copy' | 'whatsapp' | 'x' | 'linkedin' | 'system';
  method: 'native' | 'copy' | 'platform_intent' | 'system';
  canonicalUrlVersion: string;
  shareUrl: string;
}

export function emitShareTelemetry(
  name: ShareTelemetryEventName,
  payload: Omit<ShareTelemetryPayload, 'canonicalUrlVersion'> & { canonicalUrlVersion?: string },
): void {
  recordShareEvent({
    name,
    payload: {
      ...payload,
      canonicalUrlVersion: payload.canonicalUrlVersion || CANONICAL_URL_VERSION,
    },
  });
}

