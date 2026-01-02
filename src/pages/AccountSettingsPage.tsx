
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { userSettingsService } from '../services/userSettingsService';
import { SettingsSectionCard } from '../components/settings/SettingsSectionCard';
import { SettingsSidebarNav } from '../components/settings/SettingsSidebarNav';
import { AvatarSelectorModal } from '../components/settings/AvatarSelectorModal';
import { ConfirmActionModal } from '../components/settings/ConfirmActionModal';
import { Input } from '../components/UI/Input';
import { TextArea } from '../components/UI/TextArea';
import { getInitials } from '../utils/formatters';
import { User, Mail, Shield, Check, Loader2, Camera, Eye, EyeOff, LayoutTemplate, Globe, Link as LinkIcon, UserPlus, AlertTriangle, ChevronDown } from 'lucide-react';
import { ProfileFormData, UserPreferences, AVATAR_COLORS } from '../types/settings';
import { userToProfileForm, userToPreferencesForm } from '../models/userFormMappers';
import { Avatar } from '../components/shared/Avatar';
import { adminConfigService } from '../admin/services/adminConfigService';
import { HeaderSpacer } from '../components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '../constants/layout';
import { Z_INDEX } from '../constants/zIndex';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 ml-1">
    {children}
  </label>
);

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}

const Toggle: React.FC<ToggleProps> = ({ label, description, checked, onChange, icon }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
    </div>
    <button 
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${checked ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const AccountSettingsPage: React.FC<{ userId: string }> = ({ userId }) => {
  const { modularUser, currentUser } = useAuth();
  const toast = useToast();
  
  // --- STATE ---
  const [activeSection, setActiveSection] = useState('profile');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  
  // Config State
  const [enableAvatarUpload, setEnableAvatarUpload] = useState(false);
  
  // Modals
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Profile Form
  const [profileData, setProfileData] = useState<ProfileFormData & { avatarUrl?: string }>({
    displayName: '',
    username: '',
    bio: '',
    phoneNumber: '',
    avatarColor: 'blue',
    avatarUrl: ''
  });

  // Security Form
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // Preferences Form
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultVisibility: 'public',
    compactMode: true,
    richMediaPreviews: true,
    autoFollowCollections: false,
    theme: 'system',
    interestedCategories: [],
    notifications: { emailDigest: true, productUpdates: false, newFollowers: true }
  });

  // --- INIT ---
  useEffect(() => {
    // PREFER MODULAR USER if available
    if (modularUser) {
      setProfileData({
          ...userToProfileForm(modularUser),
          avatarUrl: modularUser.profile.avatarUrl
      });
      setPreferences(userToPreferencesForm(modularUser));
    } 
    // FALLBACK to Legacy User if context not yet fully migrated (safety net)
    else if (currentUser) {
      setProfileData({
        displayName: currentUser.name,
        username: currentUser.username || '',
        bio: 'Tech enthusiast and full-stack developer.', // Mock
        phoneNumber: currentUser.phoneNumber || '',
        avatarColor: 'blue',
        avatarUrl: currentUser.avatarUrl
      });
    }

    // Load Config
    adminConfigService.getFeatureFlags().then(flags => {
        setEnableAvatarUpload(flags.enableAvatarUpload);
    });
  }, [modularUser, currentUser]);

  // --- HANDLERS ---

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleProfileUpdate = async () => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      await userSettingsService.updateProfile(currentUser.id, profileData);
      toast.success("Profile updated successfully");
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setIsSavingSecurity(true);
    try {
      await userSettingsService.updatePassword(currentUser!.id, securityData.currentPassword, securityData.newPassword);
      toast.success("Password updated");
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error("Incorrect current password");
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const togglePreference = (key: keyof UserPreferences) => {
    if (!currentUser) return;
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
    userSettingsService.updatePreferences(currentUser.id, newPrefs);
  };

  const handleDeleteAccount = async () => {
    await userSettingsService.deleteAccount(currentUser!.id);
    toast.error("Account deleted. Redirecting...");
    setTimeout(() => window.location.href = '/', 2000);
  };

  const handleAvatarSelection = (result: { type: 'color' | 'image'; value: string }) => {
      if (result.type === 'color') {
          setProfileData({ ...profileData, avatarColor: result.value, avatarUrl: undefined });
      } else {
          setProfileData({ ...profileData, avatarUrl: result.value });
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <HeaderSpacer />
      
      {/* Page Header - Unified Light Theme */}
      <div 
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR} pt-8 pb-8`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Manage your identity, security, and preferences.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <SettingsSidebarNav activeSection={activeSection} onSelect={scrollToSection} />
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* 1. PROFILE */}
            <SettingsSectionCard 
              id="profile" 
              title="Public Profile" 
              description="This information will be displayed publicly on your Nuggets profile."
              icon={<User size={20} />}
              rightAction={
                <button 
                  onClick={handleProfileUpdate}
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              }
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar */}
                <div className="shrink-0 flex flex-col items-center gap-3">
                  <div className="relative group">
                    <button 
                        onClick={() => setShowAvatarModal(true)}
                        className="relative group rounded-full overflow-hidden shadow-xl transition-transform hover:scale-105"
                    >
                        {profileData.avatarUrl ? (
                            <img src={profileData.avatarUrl} alt="Avatar" className="w-24 h-24 object-cover" />
                        ) : (
                            <div className={`w-24 h-24 flex items-center justify-center text-3xl font-bold text-white ${AVATAR_COLORS[profileData.avatarColor as keyof typeof AVATAR_COLORS] || 'bg-blue-500'}`}>
                                {getInitials(profileData.displayName)}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={24} className="text-white drop-shadow-md" />
                        </div>
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Avatar</p>
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Display Name</Label>
                      <Input 
                        value={profileData.displayName}
                        onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                        placeholder="e.g. Jane Doe"
                        className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900"
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input 
                        value={profileData.username}
                        onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                        placeholder="@username"
                        leftIcon={<span className="text-slate-400 font-bold">@</span>}
                        className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900"
                      />
                      <p className="text-[10px] text-slate-400 mt-1.5">Unique handle for your profile URL.</p>
                    </div>
                  </div>

                  <div>
                    <Label>Bio</Label>
                    <TextArea 
                      value={profileData.bio}
                      onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                      placeholder="Tell us a little about yourself..."
                      rows={3}
                      className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900 resize-none"
                    />
                  </div>
                </div>
              </div>
            </SettingsSectionCard>

            {/* 2. ACCOUNT INFO */}
            <SettingsSectionCard 
              id="account" 
              title="Account Information" 
              description="Manage your login details and verification status."
              icon={<Mail size={20} />}
            >
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-slate-400">
                  <Mail size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{currentUser?.email}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Check size={10} className="mr-1" /> Verified
                    </span>
                  </div>
                </div>
                {/* Stub Button */}
                <button disabled className="text-xs font-bold text-slate-400 cursor-not-allowed">Change</button>
              </div>
            </SettingsSectionCard>

            {/* 3. SECURITY */}
            <SettingsSectionCard 
              id="security" 
              title="Security" 
              description="Update your password to keep your account safe."
              icon={<Shield size={20} />}
            >
              <form onSubmit={handlePasswordUpdate} className="max-w-md space-y-4">
                <div className="relative">
                  <Label>Current Password</Label>
                  <Input 
                    type={showPasswords ? "text" : "password"}
                    value={securityData.currentPassword}
                    onChange={(e) => setSecurityData({...securityData, currentPassword: e.target.value})}
                    className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>New Password</Label>
                    <Input 
                      type={showPasswords ? "text" : "password"}
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({...securityData, newPassword: e.target.value})}
                      className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                  <div>
                    <Label>Confirm New</Label>
                    <Input 
                      type={showPasswords ? "text" : "password"}
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({...securityData, confirmPassword: e.target.value})}
                      className="bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 flex items-center gap-1.5"
                  >
                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />} 
                    {showPasswords ? 'Hide' : 'Show'} Passwords
                  </button>

                  <button 
                    type="submit"
                    disabled={isSavingSecurity || !securityData.currentPassword || !securityData.newPassword}
                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSavingSecurity ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </SettingsSectionCard>

            {/* 4. PREFERENCES */}
            <SettingsSectionCard 
              id="preferences" 
              title="Preferences" 
              description="Customize your Nuggets experience."
              icon={<LayoutTemplate size={20} />}
            >
              <div className="space-y-4">
                {/* Visibility Radio */}
                <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-transparent">
                  <Label>Default Nugget Visibility</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="visibility" 
                        checked={preferences.defaultVisibility === 'public'}
                        onChange={() => setPreferences({...preferences, defaultVisibility: 'public'})}
                        className="text-primary-500 focus:ring-primary-500"
                      />
                      <Globe size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Public</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="visibility" 
                        checked={preferences.defaultVisibility === 'private'}
                        onChange={() => setPreferences({...preferences, defaultVisibility: 'private'})}
                        className="text-primary-500 focus:ring-primary-500"
                      />
                      <Shield size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Private</span>
                    </label>
                  </div>
                </div>

                <Toggle 
                  label="Compact Card Mode" 
                  description="Reduce whitespace in the feed for denser information."
                  checked={preferences.compactMode} 
                  onChange={() => togglePreference('compactMode')}
                  icon={<LayoutTemplate size={18} />}
                />

                <Toggle 
                  label="Rich Media Previews" 
                  description="Show full-size images and embeds in the feed."
                  checked={preferences.richMediaPreviews} 
                  onChange={() => togglePreference('richMediaPreviews')}
                  icon={<LinkIcon size={18} />}
                />

                <Toggle 
                  label="Auto-Follow Collections" 
                  description="Automatically follow a collection when you contribute to it."
                  checked={preferences.autoFollowCollections} 
                  onChange={() => togglePreference('autoFollowCollections')}
                  icon={<UserPlus size={18} />}
                />
              </div>
            </SettingsSectionCard>

            {/* 5. DANGER ZONE */}
            <div id="danger" className="border border-red-200 dark:border-red-900/30 rounded-2xl overflow-hidden bg-red-50/30 dark:bg-red-900/10">
              <button
                onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">Irreversible actions regarding your account</p>
                  </div>
                </div>
                <ChevronDown size={20} className={`text-red-400 transition-transform duration-300 ${isDangerZoneOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isDangerZoneOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-6 pt-2">
                  <div className="h-px w-full bg-red-200/50 dark:bg-red-900/30 mb-6" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-xl leading-relaxed">
                    Deleting your account is permanent. All your nuggets and collections will be wiped immediately. This action cannot be undone.
                  </p>
                  <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="px-5 py-2.5 bg-white dark:bg-slate-950 text-red-600 border border-red-200 dark:border-red-900/50 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm flex items-center gap-2"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      <AvatarSelectorModal 
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentName={profileData.displayName}
        currentColor={profileData.avatarColor || 'blue'}
        onSelect={handleAvatarSelection}
        allowUpload={enableAvatarUpload}
      />

      <ConfirmActionModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        description="This action is irreversible. All your data will be permanently removed from our servers."
        confirmString="DELETE MY ACCOUNT"
        actionLabel="Delete Everything"
        isDestructive={true}
      />

    </div>
  );
};
