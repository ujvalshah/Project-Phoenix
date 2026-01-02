
import React, { useState, useEffect } from 'react';
import { Megaphone, Save, Info, AlertTriangle, XCircle, CheckCircle2, Clock, Shield, Check, ToggleLeft, ToggleRight, Settings, Users, Mail, ClipboardType, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useAdminHeader } from '../layout/AdminLayout';
import { adminConfigService, AVAILABLE_SERVICES } from '../services/adminConfigService';
import { RolePermissions, ServiceId, AdminRole, FeatureFlags, SignupConfig } from '../types/admin';

interface SystemAnnouncement {
  active: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  expiresAt: string;
}

export const AdminConfigPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const toast = useToast();
  
  // --- Announcement State ---
  const [announcement, setAnnouncement] = useState<SystemAnnouncement>({
    active: false,
    type: 'info',
    message: '**Scheduled maintenance:** The system will be down for 15 mins at 2 AM UTC.',
    expiresAt: ''
  });

  // --- Config State ---
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [signupConfig, setSignupConfig] = useState<SignupConfig | null>(null);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  useEffect(() => {
    setPageHeader("System Configuration", "Manage global settings, feature toggles, and system alerts.");
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const [permData, flagsData, signupData] = await Promise.all([
        adminConfigService.getRolePermissions(),
        adminConfigService.getFeatureFlags(),
        adminConfigService.getSignupConfig()
      ]);
      setPermissions(permData);
      setFlags(flagsData);
      setSignupConfig(signupData);
    } catch (e) {
      toast.error("Failed to load configuration");
    }
  };

  const handleSaveAnnouncement = () => {
    toast.success("System announcement updated");
  };

  const handleTogglePermission = (role: AdminRole, serviceId: ServiceId) => {
    if (!permissions) return;
    const current = permissions[role];
    const updated = current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId];
    
    setPermissions({ ...permissions, [role]: updated });
  };

  const handleToggleFlag = async (key: keyof FeatureFlags) => {
    if (!flags) return;
    const newValue = !flags[key];
    setFlags({ ...flags, [key]: newValue }); // Optimistic
    try {
        await adminConfigService.updateFeatureFlag(key, newValue);
        toast.success(`Updated ${key}`);
    } catch (e) {
        toast.error("Failed to update flag");
        setFlags({ ...flags }); // Revert
    }
  };

  const handleUpdateSignupRule = async (field: keyof SignupConfig, ruleKey: 'show' | 'required') => {
      if (!signupConfig) return;
      const currentRule = signupConfig[field];
      const newValue = !currentRule[ruleKey];
      
      const newConfig = { ...signupConfig, [field]: { ...currentRule, [ruleKey]: newValue } };
      setSignupConfig(newConfig);

      try {
          await adminConfigService.updateSignupConfig(field, { [ruleKey]: newValue });
      } catch (e) {
          toast.error("Failed to update rule");
          setSignupConfig(signupConfig); // Revert
      }
  };

  const handleSavePermissions = async () => {
    if (!permissions) return;
    setIsSavingPerms(true);
    try {
      await Promise.all([
        adminConfigService.updateRolePermission('user', permissions.user),
        adminConfigService.updateRolePermission('admin', permissions.admin),
      ]);
      toast.success("Access privileges updated");
    } catch (e) {
      toast.error("Failed to save privileges");
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Group services by category for cleaner UI
  const groupedServices = {
    'AI Services': AVAILABLE_SERVICES.filter(s => s.category === 'ai'),
    'Data & Import': AVAILABLE_SERVICES.filter(s => s.category === 'data'),
    'Content Features': AVAILABLE_SERVICES.filter(s => s.category === 'content'),
  };

  return (
    <div>
      <div className="max-w-5xl space-y-8">
        
        {/* 1. FEATURE FLAGS */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Settings size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Feature Flags</h3>
                    <p className="text-xs text-slate-500">Toggle system capabilities on or off globally.</p>
                </div>
            </div>

            {flags ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* AVATAR UPLOAD */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Avatar File Uploads</div>
                            <div className="text-xs text-slate-500 mt-0.5">Allow users to upload custom images.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('enableAvatarUpload')}
                            className={`transition-colors ${flags.enableAvatarUpload ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.enableAvatarUpload ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>

                    {/* PUBLIC REGISTRATION */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Public Registration</div>
                            <div className="text-xs text-slate-500 mt-0.5">Allow new users to sign up.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('enablePublicSignup')}
                            className={`transition-colors ${flags.enablePublicSignup ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.enablePublicSignup ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>

                    {/* EMAIL VERIFICATION */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Email Verification</div>
                            <div className="text-xs text-slate-500 mt-0.5">Require verification before login.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('enableEmailVerification')}
                            className={`transition-colors ${flags.enableEmailVerification ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.enableEmailVerification ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>

                    {/* MAINTENANCE */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Maintenance Mode</div>
                            <div className="text-xs text-slate-500 mt-0.5">Restrict access to admins only.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('maintenanceMode')}
                            className={`transition-colors ${flags.maintenanceMode ? 'text-amber-600' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.maintenanceMode ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-slate-400">Loading flags...</div>
            )}
        </section>

        {/* 2. SIGNUP FORM CUSTOMIZATION */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ClipboardType size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Signup Form Customization</h3>
                    <p className="text-xs text-slate-500">Manage which fields are visible or mandatory during registration.</p>
                </div>
            </div>

            {signupConfig ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Field Name</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Visible</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Required</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {[
                                { key: 'location', label: 'Location (Pincode/City/Country)' },
                                { key: 'gender', label: 'Gender Selection' },
                                { key: 'phone', label: 'Phone Number' },
                                { key: 'dob', label: 'Date of Birth' }
                            ].map((row) => {
                                const config = signupConfig[row.key as keyof SignupConfig];
                                return (
                                    <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{row.label}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleUpdateSignupRule(row.key as keyof SignupConfig, 'show')}
                                                className={`transition-colors ${config.show ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}
                                            >
                                                {config.show ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleUpdateSignupRule(row.key as keyof SignupConfig, 'required')}
                                                disabled={!config.show}
                                                className={`transition-colors ${!config.show ? 'opacity-30 cursor-not-allowed' : ''} ${config.required ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}
                                            >
                                                {config.required ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-4 text-slate-400">Loading form config...</div>
            )}
        </section>

        {/* 3. GUEST RESTRICTIONS */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Users size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Guest Permissions</h3>
                    <p className="text-xs text-slate-500">Configure what non-authenticated users can do.</p>
                </div>
            </div>

            {flags ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Allow Guest Bookmarks</div>
                            <div className="text-xs text-slate-500 mt-0.5">Save to device local storage without login.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('guestBookmarks')}
                            className={`transition-colors ${flags.guestBookmarks ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.guestBookmarks ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Allow Guest Reports</div>
                            <div className="text-xs text-slate-500 mt-0.5">Anonymous content reporting.</div>
                        </div>
                        <button 
                            onClick={() => handleToggleFlag('guestReports')}
                            className={`transition-colors ${flags.guestReports ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                        >
                            {flags.guestReports ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>
                </div>
            ) : null}
        </section>

        {/* 4. RBAC MATRIX */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registered User Privileges</h3>
                <p className="text-xs text-slate-500">Fine-grained access control for signed-in accounts.</p>
              </div>
            </div>
            <button 
              onClick={handleSavePermissions}
              disabled={isSavingPerms}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingPerms ? 'Saving...' : <><Save size={14} /> Save Privileges</>}
            </button>
          </div>

          {!permissions ? (
            <div className="text-center py-8 text-slate-400">Loading configuration...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/2">Feature / Service</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-slate-900 dark:text-white w-1/4 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">Standard User</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-purple-600 dark:text-purple-400 w-1/4 bg-purple-50 dark:bg-purple-900/10 rounded-t-xl">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(groupedServices).map(([category, services]) => (
                    <React.Fragment key={category}>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={3} className="py-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {category}
                        </td>
                      </tr>
                      {services.map(service => (
                        <tr key={service.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{service.label}</div>
                            <div className="text-xs text-slate-400 font-medium">{service.description}</div>
                          </td>
                          
                          {/* User Column */}
                          <td className="py-3 px-4 text-center align-middle bg-slate-50/30 dark:bg-slate-800/20">
                            <label className="relative inline-flex items-center justify-center cursor-pointer p-2">
                              <input 
                                type="checkbox" 
                                className="peer sr-only"
                                checked={permissions['user'].includes(service.id)}
                                onChange={() => handleTogglePermission('user', service.id)}
                              />
                              <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded flex items-center justify-center peer-checked:bg-slate-900 peer-checked:border-slate-900 dark:peer-checked:bg-white dark:peer-checked:border-white transition-all">
                                <Check size={12} className="text-white dark:text-slate-900 opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                              </div>
                            </label>
                          </td>

                          {/* Admin Column */}
                          <td className="py-3 px-4 text-center align-middle bg-purple-50/30 dark:bg-purple-900/5">
                            <label className="relative inline-flex items-center justify-center cursor-pointer p-2">
                              <input 
                                type="checkbox" 
                                className="peer sr-only"
                                checked={permissions['admin'].includes(service.id)}
                                onChange={() => handleTogglePermission('admin', service.id)}
                              />
                              <div className="w-5 h-5 border-2 border-purple-200 dark:border-purple-800 rounded flex items-center justify-center peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all">
                                <Check size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                              </div>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 5. SYSTEM ANNOUNCEMENT */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">System Announcement</h3>
              <p className="text-xs text-slate-500">Broadcast a message to all users (e.g. maintenance, downtime).</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Announcement Banner</span>
              <button 
                onClick={() => setAnnouncement(p => ({ ...p, active: !p.active }))}
                className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${announcement.active ? 'bg-primary-500' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${announcement.active ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {announcement.active && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Message Type</label>
                        <div className="flex gap-2">
                            {['info', 'warning', 'error', 'success'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setAnnouncement(p => ({ ...p, type: t as any }))}
                                className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all ${announcement.type === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                            >
                                {t}
                            </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Auto-Expire At</label>
                        <div className="relative">
                            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="datetime-local" 
                                value={announcement.expiresAt}
                                onChange={(e) => setAnnouncement(p => ({ ...p, expiresAt: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Banner will automatically hide after this time.</p>
                    </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Banner Message</label>
                  <RichTextEditor 
                    value={announcement.message}
                    onChange={(val) => setAnnouncement(p => ({ ...p, message: val }))}
                    placeholder="Enter announcement text..."
                    className="min-h-[150px]"
                  />
                </div>

                {/* Preview */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Live Preview</label>
                    <div className={`p-4 rounded-lg flex items-start gap-3 text-sm font-medium ${
                    announcement.type === 'info' ? 'bg-blue-100 text-blue-800' :
                    announcement.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                    announcement.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                    }`}>
                    <div className="shrink-0 mt-0.5">
                        {announcement.type === 'info' && <Info size={18} />}
                        {announcement.type === 'warning' && <AlertTriangle size={18} />}
                        {announcement.type === 'error' && <XCircle size={18} />}
                        {announcement.type === 'success' && <CheckCircle2 size={18} />}
                    </div>
                    <div className="flex-1">
                        <MarkdownRenderer content={announcement.message} className="prose-sm max-w-none" />
                    </div>
                    </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button onClick={handleSaveAnnouncement} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg shadow-slate-900/10">
              <Save size={16} /> Save Announcement
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};
