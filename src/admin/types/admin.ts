
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
  | 'admin.feedback.view';

// --- Entity Types ---

// Mirrors backend `UserStatus` (PR7b). The third state is `banned` (a stronger
// suspension that is the canonical TOS-violation outcome), not `pending`. The
// older `pending` value never had a backend write path and is removed here so
// the table/badge code can switch on a closed set of three values.
export type AdminUserStatus = 'active' | 'suspended' | 'banned';

export interface AdminUser {
  id: string;
  name: string; // Display Name
  fullName: string; // Real Name
  username: string;
  /** Server-assigned rollout cohort for search experiments. */
  searchCohort?: string;
  email: string;
  emailVerified: boolean;
  authProvider: 'email' | 'google' | 'linkedin';
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
  lifecycleStatus?: 'draft' | 'published';
  status: AdminNuggetStatus;
  createdAt: string;
  reports: number;
  tags: string[];
  sourceType?: string;
  isYoutube?: boolean;
  thumbnailUrl?: string;
  sourceUrl?: string;
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
  /** Whether this collection appears in the home feed category toolbar */
  isFeatured: boolean;
  /** Display order in the category toolbar (lower = earlier) */
  featuredOrder: number;
  /** Parent collection ID for one-level sub-community hierarchy */
  parentId?: string | null;
}

export interface AdminTag {
  id: string;
  name: string;
  usageCount: number;
  type?: 'category' | 'tag'; // Legacy field - all tags are treated as 'tag'
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

export interface AdminStat {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: React.ReactNode;
}

export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  createdAt: string;
}
