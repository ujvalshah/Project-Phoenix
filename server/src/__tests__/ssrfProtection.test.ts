import { describe, it, expect } from 'vitest';
import { isUrlSafeForFetch, validateUrls } from '../utils/ssrfProtection.js';

describe('SSRF Protection', () => {
  describe('blocks internal/private addresses', () => {
    describe('localhost', () => {
      it('should block localhost', () => {
        expect(isUrlSafeForFetch('http://localhost/api')).toEqual({
          safe: false,
          reason: 'Internal hostname not allowed'
        });
      });

      it('should block localhost with port', () => {
        expect(isUrlSafeForFetch('http://localhost:8080/api')).toEqual({
          safe: false,
          reason: 'Internal hostname not allowed'
        });
      });

      it('should block localhost.localdomain', () => {
        expect(isUrlSafeForFetch('http://localhost.localdomain/')).toEqual({
          safe: false,
          reason: 'Internal hostname not allowed'
        });
      });
    });

    describe('loopback addresses (127.x.x.x)', () => {
      it('should block 127.0.0.1', () => {
        expect(isUrlSafeForFetch('http://127.0.0.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });

      it('should block 127.0.0.1 with port', () => {
        expect(isUrlSafeForFetch('http://127.0.0.1:3000/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });

      it('should block 127.255.255.255', () => {
        expect(isUrlSafeForFetch('http://127.255.255.255/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });
    });

    describe('private IP ranges', () => {
      it('should block 10.x.x.x (Class A private)', () => {
        expect(isUrlSafeForFetch('http://10.0.0.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
        expect(isUrlSafeForFetch('http://10.255.255.255/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });

      it('should block 192.168.x.x (Class C private)', () => {
        expect(isUrlSafeForFetch('http://192.168.1.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
        expect(isUrlSafeForFetch('http://192.168.0.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });

      it('should block 172.16-31.x.x (Class B private)', () => {
        expect(isUrlSafeForFetch('http://172.16.0.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
        expect(isUrlSafeForFetch('http://172.31.255.255/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });

      it('should allow 172.15.x.x (not private)', () => {
        // Note: 172.15.x.x is NOT in the private range
        const result = isUrlSafeForFetch('http://172.15.0.1/');
        expect(result.safe).toBe(true);
      });

      it('should allow 172.32.x.x (not private)', () => {
        const result = isUrlSafeForFetch('http://172.32.0.1/');
        expect(result.safe).toBe(true);
      });
    });

    describe('link-local addresses', () => {
      it('should block 169.254.x.x', () => {
        expect(isUrlSafeForFetch('http://169.254.1.1/')).toEqual({
          safe: false,
          reason: 'Private or reserved IP address not allowed'
        });
      });
    });

    describe('zero network', () => {
      it('should block 0.0.0.0', () => {
        expect(isUrlSafeForFetch('http://0.0.0.0/')).toEqual({
          safe: false,
          reason: 'Internal hostname not allowed'
        });
      });
    });
  });

  describe('blocks cloud metadata endpoints', () => {
    it('should block AWS/GCP/Azure metadata endpoint', () => {
      expect(isUrlSafeForFetch('http://169.254.169.254/')).toEqual({
        safe: false,
        reason: 'Cloud metadata endpoint not allowed'
      });
    });

    it('should block AWS metadata endpoint with path', () => {
      expect(isUrlSafeForFetch('http://169.254.169.254/latest/meta-data/')).toEqual({
        safe: false,
        reason: 'Cloud metadata endpoint not allowed'
      });
    });

    it('should block AWS ECS task metadata', () => {
      expect(isUrlSafeForFetch('http://169.254.170.2/v2/metadata')).toEqual({
        safe: false,
        reason: 'Cloud metadata endpoint not allowed'
      });
    });

    it('should block GCP metadata hostname', () => {
      expect(isUrlSafeForFetch('http://metadata.google.internal/')).toEqual({
        safe: false,
        reason: 'Internal hostname not allowed'
      });
    });
  });

  describe('validates protocol', () => {
    it('should block file:// protocol', () => {
      expect(isUrlSafeForFetch('file:///etc/passwd')).toEqual({
        safe: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      });
    });

    it('should block ftp:// protocol', () => {
      expect(isUrlSafeForFetch('ftp://server.com/file')).toEqual({
        safe: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      });
    });

    it('should block javascript: protocol', () => {
      expect(isUrlSafeForFetch('javascript:alert(1)')).toEqual({
        safe: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      });
    });

    it('should block data: protocol', () => {
      expect(isUrlSafeForFetch('data:text/html,<script>alert(1)</script>')).toEqual({
        safe: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      });
    });
  });

  describe('allows public URLs', () => {
    it('should allow public HTTP URLs', () => {
      expect(isUrlSafeForFetch('http://example.com/')).toEqual({ safe: true });
    });

    it('should allow public HTTPS URLs', () => {
      expect(isUrlSafeForFetch('https://example.com/')).toEqual({ safe: true });
    });

    it('should allow GitHub', () => {
      expect(isUrlSafeForFetch('https://github.com/user/repo')).toEqual({ safe: true });
    });

    it('should allow YouTube', () => {
      expect(isUrlSafeForFetch('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ safe: true });
    });

    it('should allow URLs with ports', () => {
      expect(isUrlSafeForFetch('https://example.com:8443/api')).toEqual({ safe: true });
    });

    it('should allow URLs with paths and query strings', () => {
      expect(isUrlSafeForFetch('https://api.example.com/v1/data?key=value')).toEqual({ safe: true });
    });

    it('should allow public IPs', () => {
      expect(isUrlSafeForFetch('http://8.8.8.8/')).toEqual({ safe: true });
    });
  });

  describe('handles invalid URLs', () => {
    it('should reject malformed URLs', () => {
      expect(isUrlSafeForFetch('not-a-url')).toEqual({
        safe: false,
        reason: 'Invalid URL format'
      });
    });

    it('should reject empty strings', () => {
      expect(isUrlSafeForFetch('')).toEqual({
        safe: false,
        reason: 'Invalid URL format'
      });
    });

    it('should reject URLs without protocol', () => {
      expect(isUrlSafeForFetch('example.com/path')).toEqual({
        safe: false,
        reason: 'Invalid URL format'
      });
    });
  });
});

describe('validateUrls', () => {
  it('should return empty array for all safe URLs', () => {
    const urls = [
      'https://example.com/',
      'https://github.com/',
      'https://youtube.com/'
    ];
    expect(validateUrls(urls)).toEqual([]);
  });

  it('should return unsafe URLs with reasons', () => {
    const urls = [
      'https://example.com/',        // safe
      'http://localhost/',            // unsafe
      'http://169.254.169.254/',     // unsafe
      'https://github.com/'          // safe
    ];
    
    const result = validateUrls(urls);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('http://localhost/');
    expect(result[1].url).toBe('http://169.254.169.254/');
  });
});




