
import { RolePermissions, ServiceDefinition, FeatureFlags, SignupConfig } from '../types/admin';

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
  maintenanceMode: false,
  guestBookmarks: false,
  guestReports: false,
  showAuthorName: false,
};

const INITIAL_SIGNUP_CONFIG: SignupConfig = {
  phone: { show: true, required: false },
  gender: { show: true, required: false }, // Visible but optional by default
  location: { show: true, required: true }, // Pincode/City/Country group
  dob: { show: false, required: false }, // Hidden by default (Best Practice)
};

class AdminConfigService {
  // In-memory mock storage
  private permissions: RolePermissions = { ...INITIAL_PERMISSIONS };
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
  }

  // --- FLAGS ---
  async getFeatureFlags(): Promise<FeatureFlags> {
    await delay(200);
    return { ...this.featureFlags };
  }

  async updateFeatureFlag(key: keyof FeatureFlags, value: boolean): Promise<void> {
    await delay(300);
    this.featureFlags[key] = value;
  }

  // --- SIGNUP CONFIG ---
  async getSignupConfig(): Promise<SignupConfig> {
    await delay(200);
    return { ...this.signupConfig };
  }

  async updateSignupConfig(key: keyof SignupConfig, rule: Partial<{ show: boolean, required: boolean }>): Promise<void> {
    await delay(300);
    this.signupConfig[key] = { ...this.signupConfig[key], ...rule };
  }
}

export const adminConfigService = new AdminConfigService();
