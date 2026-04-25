import { describe, expect, it, vi } from 'vitest';
import { emitShareTelemetry } from '@/observability/shareTelemetry';
import * as telemetry from '@/observability/telemetry';

describe('observability/shareTelemetry', () => {
  it('adds canonical URL version by default', () => {
    const spy = vi.spyOn(telemetry, 'recordShareEvent').mockImplementation(() => undefined);

    emitShareTelemetry('share_opened', {
      entityType: 'nugget',
      entityId: 'a1',
      surface: 'test_surface',
      platform: 'system',
      method: 'system',
      shareUrl: 'https://nuggets.one/article/a1',
    });

    expect(spy).toHaveBeenCalledWith({
      name: 'share_opened',
      payload: expect.objectContaining({
        canonicalUrlVersion: 'v2',
      }),
    });
  });
});

