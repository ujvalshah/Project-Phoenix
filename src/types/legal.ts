
export type LegalPageSlug = 'about' | 'terms' | 'privacy' | 'contact' | 'guidelines' | 'disclaimer' | 'cookie-policy';

export interface LegalPage {
  id: LegalPageSlug;
  title: string;
  slug: string;
  content: string;
  isEnabled: boolean;
  lastUpdated: string;
}

export interface LegalConfig {
  pages: Record<LegalPageSlug, LegalPage>;
}
