import { URL } from 'url';

/**
 * SSRF (Server-Side Request Forgery) Protection Utility
 * 
 * Validates URLs before fetching to prevent:
 * - Access to internal network resources (localhost, private IPs)
 * - Access to cloud metadata endpoints (AWS, GCP, Azure)
 * - Protocol-based attacks (file://, ftp://, etc.)
 * 
 * SECURITY: Always validate URLs with isUrlSafeForFetch() before making HTTP requests
 * to user-provided URLs (e.g., unfurl, webhooks, image fetching).
 */

// Private IP ranges that should be blocked (RFC 1918 + RFC 3927 + RFC 4291)
const BLOCKED_IP_PATTERNS: RegExp[] = [
  /^127\./,                         // Loopback (127.0.0.0/8)
  /^10\./,                          // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./,     // Private Class B (172.16.0.0/12)
  /^192\.168\./,                    // Private Class C (192.168.0.0/16)
  /^169\.254\./,                    // Link-local (169.254.0.0/16)
  /^0\./,                           // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,  // Carrier-grade NAT (100.64.0.0/10)
  /^192\.0\.0\./,                   // IETF Protocol Assignments (192.0.0.0/24)
  /^192\.0\.2\./,                   // Documentation (TEST-NET-1)
  /^198\.51\.100\./,                // Documentation (TEST-NET-2)
  /^203\.0\.113\./,                 // Documentation (TEST-NET-3)
  /^224\./,                         // Multicast (224.0.0.0/4)
  /^240\./,                         // Reserved (240.0.0.0/4)
  /^255\.255\.255\.255$/,           // Broadcast
  /^::1$/,                          // IPv6 loopback
  /^fc00:/i,                        // IPv6 unique local (fc00::/7)
  /^fd00:/i,                        // IPv6 unique local (fd00::/8)
  /^fe80:/i,                        // IPv6 link-local (fe80::/10)
  /^ff00:/i,                        // IPv6 multicast (ff00::/8)
  /^::$/,                           // IPv6 unspecified
  /^::ffff:/i,                      // IPv4-mapped IPv6
];

// Blocked hostnames (case-insensitive check applied)
const BLOCKED_HOSTNAMES: string[] = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  // Cloud metadata endpoints
  'metadata.google.internal',
  'metadata.google',
  'metadata',
  'instance-data',
  // Common internal hostnames
  'internal',
  'intranet',
  'corp',
  'local',
];

// Cloud provider metadata IPs
const CLOUD_METADATA_IPS: string[] = [
  '169.254.169.254',  // AWS, GCP, Azure, DigitalOcean, etc.
  '169.254.170.2',    // AWS ECS task metadata
  '100.100.100.200',  // Alibaba Cloud
  'fd00:ec2::254',    // AWS IPv6 metadata
];

/**
 * Validates a URL is safe to fetch (prevents SSRF attacks)
 * 
 * @param urlString - The URL to validate
 * @returns Object with `safe` boolean and optional `reason` for blocking
 * 
 * @example
 * const check = isUrlSafeForFetch('https://example.com');
 * if (!check.safe) {
 *   return res.status(400).json({ error: check.reason });
 * }
 * // Proceed with fetch...
 */
export function isUrlSafeForFetch(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // 1. Protocol validation - only allow http and https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
    }

    const hostname = url.hostname.toLowerCase();

    // 2. Check blocked hostnames (exact match, case-insensitive)
    if (BLOCKED_HOSTNAMES.some(blocked => hostname === blocked || hostname.endsWith(`.${blocked}`))) {
      return { safe: false, reason: 'Internal hostname not allowed' };
    }

    // 3. Check cloud metadata IPs (exact match)
    if (CLOUD_METADATA_IPS.includes(hostname)) {
      return { safe: false, reason: 'Cloud metadata endpoint not allowed' };
    }

    // 4. Check private IP patterns
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Private or reserved IP address not allowed' };
      }
    }

    // 5. Validate IPv4 addresses (ensure valid format)
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Pattern);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number);
      if (octets.some(o => o > 255)) {
        return { safe: false, reason: 'Invalid IP address format' };
      }
    }

    // 6. Block hostnames that look like they're trying to bypass DNS
    // (e.g., decimal IP notation, hexadecimal IP, etc.)
    const suspiciousPatterns = [
      /^0x[0-9a-f]+$/i,           // Hexadecimal IP
      /^\d{8,}$/,                  // Decimal IP (large number)
      /^0\d+\./,                   // Octal IP notation
    ];
    if (suspiciousPatterns.some(p => p.test(hostname))) {
      return { safe: false, reason: 'Suspicious hostname format' };
    }

    // 7. Block hostnames with DNS rebinding potential
    // (very short hostnames that could be controlled by attacker)
    if (hostname.length < 4 && !hostname.includes('.')) {
      return { safe: false, reason: 'Hostname too short' };
    }

    // All checks passed
    return { safe: true };
  } catch (error) {
    // URL parsing failed
    return { safe: false, reason: 'Invalid URL format' };
  }
}

/**
 * Validates multiple URLs and returns all that are unsafe
 * 
 * @param urls - Array of URLs to validate
 * @returns Array of unsafe URLs with their reasons
 */
export function validateUrls(urls: string[]): Array<{ url: string; reason: string }> {
  return urls
    .map(url => ({ url, ...isUrlSafeForFetch(url) }))
    .filter(result => !result.safe)
    .map(({ url, reason }) => ({ url, reason: reason || 'Unknown' }));
}




