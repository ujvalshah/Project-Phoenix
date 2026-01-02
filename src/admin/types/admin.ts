
import React from 'react';

// --- RBAC Types ---
export type AdminRole = 'user' | 'admin' | 'superadmin';

export type AdminPermission = 
  | 'admin.access'
  | 'admin.users.view'
  | 'admin.users.edit'
  | 'admin.users.suspend'
  | 'admin.nuggets.view'
  | 'admin.nuggets.hide'
  | 'admin.nuggets.delete'
  | 'admin.collections.view'
  | 'admin.collections.edit'
  | 'admin.tags.manage'
  | 'admin.config.manage'
  | 'admin.moderation.view'
  | 'admin.activity.view'
  | 'admin.feedback.view';

// --- Service Privilege Types ---
export type ServiceId = 
  | 'batch_import'
  | 'ai_summary'
  | 'ai_auto_tag'
  | 'create_public_collection'
  | 'view_analytics'
  | 'data_export'
  | 'unlimited_nuggets';

export interface ServiceDefinition {
  id: ServiceId;
  label: string;
  description: string;
  category: 'content' | 'ai' | 'data';
}

export type RolePermissions = Record<AdminRole, ServiceId[]>;

export interface FeatureFlags {
  enableAvatarUpload: boolean;
  enablePublicSignup: boolean;
  enableEmailVerification: boolean;
  maintenanceMode: boolean;
  // Guest Capabilities
  guestBookmarks: boolean;
  guestReports: boolean;
}

// --- Signup Configuration Types ---
export interface FieldRule {
  show: boolean;
  required: boolean;
}

export interface SignupConfig {
  phone: FieldRule;
  gender: FieldRule;
  location: FieldRule; // Covers Pincode, City, Country
  dob: FieldRule; // New Date of Birth field
}

// --- Entity Types ---

export type AdminUserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUser {
  id: string;
  name: string; // Display Name
  fullName: string; // Real Name
  username: string;
  email: string;
  role: AdminRole;
  status: AdminUserStatus;
  avatarUrl?: string;
  joinedAt: string;
  lastLoginAt?: string;
  stats: {
    nuggets: number;
    nuggetsPublic: number;
    nuggetsPrivate: number;
    collections: number;
    collectionsFollowing: number;
    reports: number;
  };
}

export type AdminNuggetStatus = 'active' | 'hidden' | 'flagged';

export interface AdminNugget {
  id: string;
  title: string;
  excerpt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  type: 'link' | 'text' | 'video' | 'image' | 'idea';
  url?: string;
  visibility: 'public' | 'private';
  status: AdminNuggetStatus;
  createdAt: string;
  reports: number;
  tags: string[];
}

export interface AdminCollection {
  id: string;
  name: string;
  description?: string;
  creator: {
    id: string;
    name: string;
  };
  type: 'public' | 'private';
  itemCount: number;
  followerCount: number;
  status: 'active' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

export interface AdminTag {
  id: string;
  name: string;
  usageCount: number;
  type: 'category' | 'tag';
  isOfficial: boolean;
  status: 'active' | 'deprecated' | 'pending';
  requestedBy?: string;
}

export interface AdminTagRequest {
  id: string;
  name: string;
  requestedBy: {
    id: string;
    name: string;
  };
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AdminReport {
  id: string;
  targetId: string;
  targetType: 'nugget' | 'user' | 'collection';
  reason: 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other';
  description?: string;
  reporter: {
    id: string;
    name: string;
  };
  respondent: {
    id: string;
    name: string;
  };
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface AdminFeedback {
  id: string;
  user?: {
    id: string;
    name: string;
    fullName?: string;
    username?: string;
    avatar?: string;
  };
  type: 'bug' | 'feature' | 'general';
  content: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}

export interface AdminActivityEvent {
  id: string;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  target?: string;
  metadata?: string;
  timestamp: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

export interface AdminStat {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: React.ReactNode;
}
