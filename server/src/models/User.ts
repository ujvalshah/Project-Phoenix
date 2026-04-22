import mongoose, { Schema, Document } from 'mongoose';

// Nested schemas matching the modular User interface from src/types/user.ts

export interface IUserAuth {
  email: string;
  emailVerified: boolean;
  provider: 'email' | 'google' | 'linkedin';
  createdAt: string; // ISO Date
  updatedAt?: string; // ISO Date
}

export interface IUserProfile {
  displayName: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  avatarColor?: 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate';
  phoneNumber?: string;
  location?: string;
  pincode?: string;
  city?: string;
  country?: string;
  gender?: string;
  dateOfBirth?: string;
  website?: string;
  title?: string;
  company?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
}

export interface IUserSecurity {
  lastPasswordChangeAt?: string; // ISO Date
  mfaEnabled: boolean;
}

export type NotificationFrequency = 'instant' | 'daily' | 'weekly' | 'none';

export interface IUserPreferences {
  theme: 'light' | 'dark' | 'system';
  interestedCategories: string[];
  notifications: {
    emailDigest: boolean;
    productUpdates: boolean;
    newFollowers: boolean;
    pushEnabled: boolean;
    frequency: NotificationFrequency;
    categoryFilter: string[];
    quietHoursStart?: string;
    quietHoursEnd?: string;
    // IANA timezone (e.g. "Asia/Kolkata"). Defaults to UTC so quiet hours are
    // meaningful even when the client didn't send a zone.
    timezone?: string;
  };
}

export interface IUserAppState {
  lastLoginAt?: string;
  onboardingCompleted: boolean;
  featureFlags?: Record<string, boolean>;
}

export type UserStatus = 'active' | 'suspended' | 'banned';

export interface IUser extends Document {
  role: 'admin' | 'user';
  password?: string; // Hashed password (not selected by default)
  /**
   * Account lifecycle state, mutated only by the audited admin endpoints
   * (POST /api/admin/users/:id/{suspend,ban,activate}). 'suspended' is
   * reversible; 'banned' is intended to be permanent. Both block new logins
   * and (via tokenVersion bump on transition) invalidate any live access
   * token. Missing/undefined is coerced to 'active' so pre-migration users
   * stay loggable.
   */
  status?: UserStatus;
  /**
   * Monotonically increasing counter bumped whenever every live access token
   * for this user must be invalidated immediately (role change, email change,
   * password reset, suspend/ban, soft delete, admin revoke-sessions). The
   * value is embedded in newly-minted access tokens; `authenticateToken`
   * compares the embedded value against the current DB value and rejects
   * mismatches with `SESSION_REVOKED` when ENFORCE_TOKEN_VERSION is true.
   * Defaults to 0; missing/undefined is treated as 0 to keep migration safe.
   */
  tokenVersion?: number;
  auth: IUserAuth;
  profile: IUserProfile;
  security: IUserSecurity;
  preferences: IUserPreferences;
  appState: IUserAppState;
}

// Sub-schemas
const UserAuthSchema = new Schema<IUserAuth>({
  email: { type: String, required: true, unique: true, lowercase: true },
  emailVerified: { type: Boolean, default: false },
  provider: { type: String, enum: ['email', 'google', 'linkedin'], default: 'email' },
  createdAt: { type: String, required: true },
  updatedAt: { type: String }
}, { _id: false });

const UserProfileSchema = new Schema<IUserProfile>({
  displayName: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  bio: { type: String },
  avatarUrl: { type: String },
  avatarColor: { 
    type: String, 
    enum: ['blue', 'green', 'purple', 'amber', 'rose', 'teal', 'indigo', 'slate'],
    default: 'blue'
  },
  phoneNumber: { type: String },
  location: { type: String },
  pincode: { type: String },
  city: { type: String },
  country: { type: String },
  gender: { type: String },
  dateOfBirth: { type: String },
  website: { type: String },
  title: { type: String },
  company: { type: String },
  twitter: { type: String },
  linkedin: { type: String },
  youtube: { type: String },
  instagram: { type: String },
  facebook: { type: String }
}, { _id: false });

const UserSecuritySchema = new Schema<IUserSecurity>({
  lastPasswordChangeAt: { type: String },
  mfaEnabled: { type: Boolean, default: false }
}, { _id: false });

const UserPreferencesSchema = new Schema<IUserPreferences>({
  theme: { 
    type: String, 
    enum: ['light', 'dark', 'system'], 
    default: 'system' 
  },
  interestedCategories: { type: [String], default: [] },
  notifications: {
    emailDigest: { type: Boolean, default: true },
    productUpdates: { type: Boolean, default: false },
    newFollowers: { type: Boolean, default: true },
    pushEnabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['instant', 'daily', 'weekly', 'none'], default: 'instant' },
    categoryFilter: { type: [String], default: [] },
    quietHoursStart: { type: String, required: false },
    quietHoursEnd: { type: String, required: false },
    timezone: { type: String, required: false, default: 'Etc/UTC' },
  }
}, { _id: false });

const UserAppStateSchema = new Schema<IUserAppState>({
  lastLoginAt: { type: String },
  onboardingCompleted: { type: Boolean, default: false },
  featureFlags: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

// Main User schema
const UserSchema = new Schema<IUser>({
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  password: {
    type: String,
    select: false // Don't include password in queries by default
  },
  // See IUser.status. Default 'active'; pre-migration docs without the field
  // are coerced to 'active' on read by the login gate.
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active', index: true },
  // See IUser.tokenVersion. Default 0; absent fields are coerced to 0 in the
  // middleware comparison so existing pre-migration tokens still validate.
  tokenVersion: { type: Number, default: 0 },
  auth: { type: UserAuthSchema, required: true },
  profile: { type: UserProfileSchema, required: true },
  security: { type: UserSecuritySchema, required: true },
  preferences: { type: UserPreferencesSchema, required: true },
  appState: { type: UserAppStateSchema, required: true }
}, {
  timestamps: true // Auto-manage createdAt / updatedAt
});

// Explicit indexes for performance
// Note: Unique indexes on 'auth.email' and 'profile.username' are automatically created 
// by 'unique: true' constraints in the schema fields above - no need to duplicate them here
// Additional indexes for common query patterns
UserSchema.index({ role: 1 }); // For admin queries
UserSchema.index({ 'appState.lastLoginAt': -1 }); // For sorting by last login

export const User = mongoose.model<IUser>('User', UserSchema);









