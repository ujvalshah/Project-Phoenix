export const SITE_ORIGIN = 'https://nuggets.one';
export const SITE_NAME = 'Nuggets';
export const DEFAULT_TITLE = 'Nuggets: The Knowledge App';
export const DEFAULT_DESCRIPTION =
  'Curated high-signal insights across markets, geopolitics, AI, and technology. Save time and follow signal, not noise.';

export interface PublicRouteSeo {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
}

const staticRoutes: Record<string, PublicRouteSeo> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
  },
  '/collections': {
    title: 'Collections | Nuggets',
    description:
      'Browse curated Nuggets collections across markets, geopolitics, AI, technology, and high-signal research workflows.',
    canonicalPath: '/collections',
  },
  '/contact': {
    title: 'Contact Nuggets',
    description: 'Contact the Nuggets team for support, feedback, partnerships, or product questions.',
    canonicalPath: '/contact',
  },
  '/forgot-password': {
    title: 'Reset Your Nuggets Password',
    description: 'Request a secure password reset link for your Nuggets account.',
    canonicalPath: '/forgot-password',
    noindex: true,
  },
  '/reset-password': {
    title: 'Set a New Nuggets Password',
    description: 'Set a new password for your Nuggets account.',
    canonicalPath: '/reset-password',
    noindex: true,
  },
};

const legalTitles: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  disclaimer: 'Disclaimer',
  copyright: 'Copyright Policy',
  guidelines: 'Community Guidelines',
  'cookie-policy': 'Cookie Policy',
};

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path === '/' ? '/' : path.replace(/\/+$/, '')}`;
}

export function resolvePublicRouteSeo(pathname: string): PublicRouteSeo {
  if (staticRoutes[pathname]) return staticRoutes[pathname];

  const legalMatch = pathname.match(/^\/legal\/([^/]+)$/);
  if (legalMatch) {
    const slug = legalMatch[1];
    const title = legalTitles[slug] || 'Legal Page';
    return {
      title: `${title} | Nuggets`,
      description: `${title} for Nuggets users and visitors.`,
      canonicalPath: `/legal/${slug}`,
    };
  }

  if (pathname.match(/^\/collections\/[^/]+$/)) {
    return {
      title: 'Nuggets Collection',
      description: 'Explore a curated Nuggets collection of high-signal insights and sources.',
      canonicalPath: pathname,
    };
  }

  if (pathname.match(/^\/article\/[^/]+$/)) {
    return {
      title: 'Nugget',
      description: 'Read a curated high-signal insight on Nuggets.',
      canonicalPath: pathname,
    };
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: pathname === '/' ? '/' : pathname,
    noindex: true,
  };
}
