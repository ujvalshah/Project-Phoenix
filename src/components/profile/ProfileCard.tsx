import React, { useState, useRef, useEffect } from 'react';
import { User } from '@/types';
import { MapPin, Link as LinkIcon, Twitter, Linkedin, Github, Camera, Save, Edit3, Calendar, Loader2, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { storageService } from '@/services/storageService';
import { Avatar } from '../shared/Avatar';
import { adminConfigService } from '@/admin/services/adminConfigService';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { useMediaUpload } from '@/hooks/useMediaUpload';

// Simple Instagram and Facebook icons (not in lucide-react)
const InstagramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      fill="currentColor"
    />
  </svg>
);

const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      fill="currentColor"
    />
  </svg>
);

// Format join date as "Jan 2024"
const formatJoinDate = (isoString: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  } catch (e) {
    return '';
  }
};

interface ProfileCardProps {
  user: User;
  isOwner: boolean;
  nuggetCount: number;
  onUpdate: (updatedUser: User) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ user, isOwner, nuggetCount, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allowUpload, setAllowUpload] = useState(false);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUpload = useMediaUpload({ purpose: 'avatar' });

  useEffect(() => {
    adminConfigService.getFeatureFlags().then(flags => {
        setAllowUpload(flags.enableAvatarUpload);
    });
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: user.profile.displayName,
    avatarUrl: user.profile.avatarUrl || '',
    title: user.profile.title || '',
    company: user.profile.company || '',
    bio: user.profile.bio || '',
    location: user.profile.location || '',
    website: user.profile.website || '',
    twitter: user.profile.twitter || '',
    linkedin: user.profile.linkedin || '',
    youtube: user.profile.youtube || '',
    instagram: user.profile.instagram || '',
    facebook: user.profile.facebook || '',
  });

  // Sync formData when user prop changes (e.g., after update)
  useEffect(() => {
    if (!isEditing) {
      setFormData({
        name: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl || '',
        title: user.profile.title || '',
        company: user.profile.company || '',
        bio: user.profile.bio || '',
        location: user.profile.location || '',
        website: user.profile.website || '',
        twitter: user.profile.twitter || '',
        linkedin: user.profile.linkedin || '',
        youtube: user.profile.youtube || '',
        instagram: user.profile.instagram || '',
        facebook: user.profile.facebook || '',
      });
    }
  }, [user, isEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size must be less than 2MB");
        return;
      }
      
      // Upload to Cloudinary via media upload hook
      const uploadResult = await mediaUpload.upload(file);
      if (uploadResult && uploadResult.secureUrl) {
        // Use secureUrl instead of Base64
        setFormData(prev => ({ ...prev, avatarUrl: uploadResult.secureUrl }));
        toast.success("Avatar uploaded successfully");
      } else {
        toast.error(`Failed to upload avatar: ${mediaUpload.error || 'Unknown error'}`);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update all profile fields - backend supports flat fields (title, company, twitter, linkedin, youtube, instagram, facebook)
      const updatedUser = await storageService.updateUser(user.id, { 
        name: formData.name,
        avatarUrl: formData.avatarUrl,
        bio: formData.bio,
        location: formData.location,
        website: formData.website,
        ...(formData.title && { title: formData.title }),
        ...(formData.company && { company: formData.company }),
        ...(formData.twitter && { twitter: formData.twitter }),
        ...(formData.linkedin && { linkedin: formData.linkedin }),
        ...(formData.youtube && { youtube: formData.youtube }),
        ...(formData.instagram && { instagram: formData.instagram }),
        ...(formData.facebook && { facebook: formData.facebook }),
      } as Partial<User>);
      
      if (updatedUser) {
        onUpdate(updatedUser);
        setIsEditing(false);
        toast.success("Profile updated");
      }
    } catch (e) {
      console.error("Failed to save profile:", e);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to current user data
    setFormData({
        name: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl || '',
        title: user.profile.title || '',
        company: user.profile.company || '',
        bio: user.profile.bio || '',
        location: user.profile.location || '',
        website: user.profile.website || '',
        twitter: user.profile.twitter || '',
        linkedin: user.profile.linkedin || '',
        youtube: user.profile.youtube || '',
        instagram: user.profile.instagram || '',
        facebook: user.profile.facebook || '',
    });
    setIsEditing(false);
  };

  return (
    <>
      {/* Offset: Header only - ProfileCard is used in MySpacePage without CategoryFilterBar */}
      <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} flex flex-col gap-6 items-center text-center`}>
      {/* 1. Avatar Section - Centered */}
      <div className="relative w-24 h-24 mx-auto">
        <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center overflow-hidden">
            <Avatar 
              name={isEditing ? formData.name : user.profile.displayName} 
              src={(isEditing ? formData.avatarUrl : user.profile.avatarUrl) || undefined} 
              size="xl" 
              className="w-full h-full text-3xl" 
            />
        </div>
        {isEditing && allowUpload && (
            <>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full hover:bg-primary-500 hover:text-slate-900 transition-colors shadow-md z-10"
                >
                    <Camera size={14} />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                />
            </>
        )}
      </div>

      {/* 2. Main Info */}
      <div className="flex flex-col gap-4">
        {isEditing ? (
            <div className="space-y-3 animate-in fade-in duration-200">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                    <input 
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Title & Company</label>
                    <input 
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="Job Title"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                    <input 
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="Company"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Bio</label>
                    <textarea 
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Location</label>
                    <input 
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                </div>
            </div>
        ) : (
            <div className="animate-in fade-in duration-200">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{user.profile.displayName}</h1>
                {user.profile.username && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">@{user.profile.username}</p>
                )}
                {(user.profile.title || user.profile.company) && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
                        {user.profile.title && user.profile.company 
                            ? `${user.profile.title} at ${user.profile.company}`
                            : user.profile.title || user.profile.company}
                    </p>
                )}
                {user.profile.bio && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                        {user.profile.bio}
                    </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    {user.profile.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin size={14} />
                            <span>{user.profile.location}</span>
                        </div>
                    )}
                    {user.auth.createdAt && (
                        <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span>Joined {formatJoinDate(user.auth.createdAt)}</span>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* 3. Stats - Followers removed for MVP, Centered, Sentence Case */}
      {!isEditing && (
        <div className="flex items-center justify-center py-4 border-t border-b border-slate-100 dark:border-slate-800">
            <div className="text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">{nuggetCount}</div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider">Nuggets</div>
            </div>
        </div>
      )}

      {/* 4. Social Links */}
      <div className="flex flex-col gap-2">
        {isEditing ? (
            <>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Social Links</label>
                <div className="flex items-center gap-2">
                    <LinkIcon size={16} className="text-slate-400" />
                    <input name="website" value={formData.website} onChange={handleInputChange} placeholder="Website" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <Twitter size={16} className="text-slate-400" />
                    <input name="twitter" value={formData.twitter} onChange={handleInputChange} placeholder="Twitter" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <Linkedin size={16} className="text-slate-400" />
                    <input name="linkedin" value={formData.linkedin} onChange={handleInputChange} placeholder="LinkedIn" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <Youtube size={16} className="text-slate-400" />
                    <input name="youtube" value={formData.youtube} onChange={handleInputChange} placeholder="YouTube" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <InstagramIcon size={16} className="text-slate-400" />
                    <input name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder="Instagram" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <FacebookIcon size={16} className="text-slate-400" />
                    <input name="facebook" value={formData.facebook} onChange={handleInputChange} placeholder="Facebook" className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white" />
                </div>
            </>
        ) : (
            <div className="flex gap-3 pt-1">
                {user.profile.website && (
                    <a href={user.profile.website} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors">
                        <LinkIcon size={18} />
                    </a>
                )}
                {user.profile.twitter && (
                    <a href={`https://twitter.com/${user.profile.twitter}`} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                        <Twitter size={18} />
                    </a>
                )}
                {user.profile.linkedin && (
                    <a href={`https://linkedin.com/in/${user.profile.linkedin}`} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                        <Linkedin size={18} />
                    </a>
                )}
                {user.profile.youtube && (
                    <a href={user.profile.youtube.startsWith('http') ? user.profile.youtube : `https://youtube.com/${user.profile.youtube}`} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <Youtube size={18} />
                    </a>
                )}
                {user.profile.instagram && (
                    <a href={user.profile.instagram.startsWith('http') ? user.profile.instagram : `https://instagram.com/${user.profile.instagram}`} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-colors">
                        <InstagramIcon size={18} />
                    </a>
                )}
                {user.profile.facebook && (
                    <a href={user.profile.facebook.startsWith('http') ? user.profile.facebook : `https://facebook.com/${user.profile.facebook}`} target="_blank" rel="noopener" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                        <FacebookIcon size={18} />
                    </a>
                )}
            </div>
        )}
      </div>

      {/* 5. Action Buttons (Always Last) */}
      {isOwner && (
        <div className="pt-2">
            {isEditing ? (
                <div className="flex gap-3">
                    <button 
                        onClick={handleCancel}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <span className="animate-pulse">Saving...</span>
                        ) : (
                            <>
                                <Save size={16} />
                                <span>Save</span>
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2 group shadow-sm"
                >
                    <Edit3 size={16} className="text-slate-500 group-hover:text-primary-500 transition-colors" />
                    Edit Profile
                </button>
            )}
        </div>
      )}
      </div>
    </>
  );
};
