
import { RolePermissions, ServiceDefinition, FeatureFlags, SignupConfig } from '../types/admin';
import { LegalPage, LegalPageSlug, LegalConfig } from '@/types/legal';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const AVAILABLE_SERVICES: ServiceDefinition[] = [
  { id: 'batch_import', label: 'Batch Import', description: 'Import content via CSV/Excel.', category: 'data' },
  { id: 'data_export', label: 'Data Export', description: 'Download personal data.', category: 'data' },
  { id: 'ai_summary', label: 'AI Summaries', description: 'Generate AI takeaways for nuggets.', category: 'ai' },
  { id: 'ai_auto_tag', label: 'AI Auto-Tagging', description: 'Suggest tags based on content.', category: 'ai' },
  { id: 'create_public_collection', label: 'Public Collections', description: 'Publish collections to the community.', category: 'content' },
  { id: 'view_analytics', label: 'View Analytics', description: 'Access read/view counts on content.', category: 'content' },
  { id: 'unlimited_nuggets', label: 'Unlimited Nuggets', description: 'Bypass storage quotas.', category: 'content' },
];

const INITIAL_PERMISSIONS: RolePermissions = {
  admin: ['batch_import', 'data_export', 'ai_summary', 'ai_auto_tag', 'create_public_collection', 'view_analytics', 'unlimited_nuggets'],
  user: ['create_public_collection', 'ai_summary'],
  superadmin: ['batch_import', 'data_export', 'ai_summary', 'ai_auto_tag', 'create_public_collection', 'view_analytics', 'unlimited_nuggets']
};

const INITIAL_FLAGS: FeatureFlags = {
  enableAvatarUpload: false, 
  enablePublicSignup: true,
  enableEmailVerification: false,
  maintenanceMode: false,
  guestBookmarks: false,
  guestReports: false,
};

const INITIAL_SIGNUP_CONFIG: SignupConfig = {
  phone: { show: true, required: false },
  gender: { show: true, required: false }, // Visible but optional by default
  location: { show: true, required: true }, // Pincode/City/Country group
  dob: { show: false, required: false }, // Hidden by default (Best Practice)
};

// --- MOCK LEGAL CONTENT ---
const INITIAL_LEGAL_CONFIG: LegalConfig = {
  pages: {
    about: {
      id: 'about',
      title: 'About Us',
      slug: 'about',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# About Nuggets

**Busy people need relevant information in less time.**

Nuggets is designed to strip away the noise of the modern web. We believe in high-signal, low-latency knowledge consumption. 

### Our Mission
To empower professionals to stay informed without the doom-scrolling. We curate, summarize, and organize the world's most valuable insights into bite-sized "nuggets".

### The Team
We are a small, distributed team of designers, engineers, and curators passionate about information architecture and digital wellbeing.`
    },
    terms: {
      id: 'terms',
      title: 'Terms of Service',
      slug: 'terms',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# Terms of Service

By using Nuggets, you agree to these terms.

1. **Acceptable Use**: You agree not to misuse the platform or post harmful content.
2. **Content Ownership**: You retain rights to your content, but grant us a license to display it.
3. **Termination**: We reserve the right to suspend accounts that violate our policies.

*These terms are subject to change.*`
    },
    privacy: {
      id: 'privacy',
      title: 'Privacy Policy',
      slug: 'privacy',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# Privacy Policy

Your privacy is paramount.

**Data We Collect**:
- Account information (email, name)
- Usage data (bookmarks, collections)

**How We Use It**:
- To provide and improve the service.
- We **do not** sell your data to third parties.

**Your Rights**:
- You can export or delete your data at any time via the Settings page.`
    },
    contact: {
      id: 'contact',
      title: 'Contact Us',
      slug: 'contact',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# Contact Us

We'd love to hear from you.

**Support**: support@nuggets.app  
**Partnerships**: partners@nuggets.app  
**Press**: press@nuggets.app

Or use the **Feedback** form located in the Main Menu (click the top-left menu icon).`
    },
    guidelines: {
      id: 'guidelines',
      title: 'Community Guidelines',
      slug: 'guidelines',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# Community Guidelines

1. **Be Respectful**: Disagreement is fine, harassment is not.
2. **No Spam**: Do not use Nuggets purely for self-promotion.
3. **Quality Matters**: Ensure your shared nuggets provide value to others.

Violations may result in content removal or account suspension.`
    },
    disclaimer: {
      id: 'disclaimer',
      title: 'Disclaimer',
      slug: 'disclaimer',
      isEnabled: true,
      lastUpdated: new Date().toISOString(),
      content: `# Disclaimer

The content provided on Nuggets is for informational purposes only. We do not guarantee the accuracy or completeness of any information found here. 

Links to third-party websites are provided for convenience; we do not endorse their content.`
    },
    'cookie-policy': {
      id: 'cookie-policy',
      title: 'Cookie Policy',
      slug: 'cookie-policy',
      isEnabled: false, // Disabled by default
      lastUpdated: new Date().toISOString(),
      content: `# Cookie Policy

We use cookies to improve your experience.

- **Essential Cookies**: Required for login and security.
- **Analytics Cookies**: Help us understand how you use the site.

You can manage cookie preferences in your browser settings.`
    }
  }
};

class AdminConfigService {
  // In-memory mock storage
  private permissions: RolePermissions = { ...INITIAL_PERMISSIONS };
  private legalConfig: LegalConfig = { ...INITIAL_LEGAL_CONFIG };
  private featureFlags: FeatureFlags = { ...INITIAL_FLAGS };
  private signupConfig: SignupConfig = { ...INITIAL_SIGNUP_CONFIG };

  // --- RBAC ---
  async getRolePermissions(): Promise<RolePermissions> {
    await delay(400);
    return JSON.parse(JSON.stringify(this.permissions));
  }

  async updateRolePermission(role: keyof RolePermissions, services: string[]): Promise<void> {
    await delay(300);
    this.permissions[role] = services as any;
    console.log(`[Config] Updated permissions for ${String(role)}:`, services);
  }

  // --- FLAGS ---
  async getFeatureFlags(): Promise<FeatureFlags> {
    await delay(200);
    return { ...this.featureFlags };
  }

  async updateFeatureFlag(key: keyof FeatureFlags, value: boolean): Promise<void> {
    await delay(300);
    this.featureFlags[key] = value;
    console.log(`[Config] Updated flag ${String(key)} to ${value}`);
  }

  // --- SIGNUP CONFIG ---
  async getSignupConfig(): Promise<SignupConfig> {
    await delay(200);
    return { ...this.signupConfig };
  }

  async updateSignupConfig(key: keyof SignupConfig, rule: Partial<{ show: boolean, required: boolean }>): Promise<void> {
    await delay(300);
    this.signupConfig[key] = { ...this.signupConfig[key], ...rule };
    console.log(`[Config] Updated signup rule for ${key}:`, this.signupConfig[key]);
  }

  // --- LEGAL PAGES ---
  async getLegalPages(): Promise<LegalPage[]> {
    await delay(300);
    return Object.values(this.legalConfig.pages);
  }

  async getLegalPage(slug: string): Promise<LegalPage | undefined> {
    await delay(200);
    return Object.values(this.legalConfig.pages).find(p => p.slug === slug);
  }

  async updateLegalPage(id: LegalPageSlug, updates: Partial<LegalPage>): Promise<void> {
    await delay(500);
    const current = this.legalConfig.pages[id];
    if (current) {
        this.legalConfig.pages[id] = { 
            ...current, 
            ...updates,
            lastUpdated: updates.content ? new Date().toISOString() : current.lastUpdated 
        };
    }
  }
}

export const adminConfigService = new AdminConfigService();
