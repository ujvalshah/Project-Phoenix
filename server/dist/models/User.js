import mongoose, { Schema } from 'mongoose';
// Sub-schemas
const UserAuthSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    provider: { type: String, enum: ['email', 'google', 'linkedin'], default: 'email' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String }
}, { _id: false });
const UserProfileSchema = new Schema({
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
const UserSecuritySchema = new Schema({
    lastPasswordChangeAt: { type: String },
    mfaEnabled: { type: Boolean, default: false }
}, { _id: false });
const UserPreferencesSchema = new Schema({
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
const UserAppStateSchema = new Schema({
    lastLoginAt: { type: String },
    onboardingCompleted: { type: Boolean, default: false },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    searchCohort: { type: String, trim: true },
}, { _id: false });
// Main User schema
const UserSchema = new Schema({
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
export const User = mongoose.model('User', UserSchema);
//# sourceMappingURL=User.js.map