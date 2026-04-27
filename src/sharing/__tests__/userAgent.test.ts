import { describe, expect, it } from 'vitest';
import { detectInAppBrowser, isKnownBrokenInAppBrowser } from '@/sharing/userAgent';

describe('sharing/userAgent', () => {
  it('detects Instagram IAB', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Instagram 320.0.0.0',
      ),
    ).toBe('instagram');
  });

  it('detects Facebook IAB via FBAN', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0.0;FBBV/...]',
      ),
    ).toBe('facebook');
  });

  it('detects Facebook IAB via FBAV', () => {
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android) FBAV/450.0.0.0')).toBe('facebook');
  });

  it('detects TikTok IAB via musical_ly', () => {
    expect(
      detectInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 musical_ly_30.5.0'),
    ).toBe('tiktok');
  });

  it('detects TikTok IAB via BytedanceWebview', () => {
    expect(
      detectInAppBrowser('Mozilla/5.0 (Linux; Android) BytedanceWebview/0.0.123'),
    ).toBe('tiktok');
  });

  it('detects LinkedIn IAB', () => {
    expect(detectInAppBrowser('Mozilla/5.0 (iPhone) LinkedInApp/9.27.5')).toBe('linkedin');
  });

  it('returns null for regular Mobile Safari', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      ),
    ).toBeNull();
  });

  it('returns null for regular Android Chrome', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBeNull();
  });

  it('returns null for empty UA', () => {
    expect(detectInAppBrowser('')).toBeNull();
  });

  it('isKnownBrokenInAppBrowser is true for Instagram', () => {
    expect(isKnownBrokenInAppBrowser('Mozilla/5.0 (iPhone) Instagram 320.0.0.0')).toBe(true);
  });

  it('isKnownBrokenInAppBrowser is false for regular Safari', () => {
    expect(
      isKnownBrokenInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Version/17.2 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });
});
