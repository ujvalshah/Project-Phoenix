/**
 * Public user view (PR8 / P1.5).
 *
 * The User document is a kitchen sink — auth metadata, security flags,
 * notification preferences, app state (lastLoginAt!), tokenVersion, lifecycle
 * status, and PII inside profile (phoneNumber, dateOfBirth, gender, pincode,
 * city, country). Returning the raw doc to a public read endpoint with just
 * the email blanked leaks all of that.
 *
 * `toPublicUserView` is the SOLE allowlist used by every public-facing user
 * read. It is a strict serializer (whitelist, not blacklist): if a future
 * field is added to the User model it stays hidden from public consumers
 * unless someone explicitly adds it here.
 *
 * Anything that is NOT in this file is private to the user, the user's
 * admins, or the system itself. In particular, this view never includes:
 *   - email, emailVerified, provider, createdAt/updatedAt under auth
 *   - security.* (mfaEnabled, lastPasswordChangeAt)
 *   - preferences.* (interestedCategories, notification settings)
 *   - appState.* (lastLoginAt, onboarding flags, featureFlags)
 *   - status, tokenVersion, password
 *   - profile.phoneNumber, profile.dateOfBirth, profile.gender,
 *     profile.pincode, profile.city, profile.country
 *
 * Tests in `__tests__/userPublicView.test.ts` lock this contract down.
 */
function pickString(source, key) {
    if (!source)
        return undefined;
    const value = source[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/**
 * Convert a User document (or already-plain object) to its public view.
 * Returns null if the input doesn't have an id we can serialize.
 */
export function toPublicUserView(user) {
    if (!user)
        return null;
    const plain = typeof user.toObject === 'function' ? user.toObject() : user;
    const rawId = (plain._id ?? plain.id);
    if (rawId === undefined || rawId === null)
        return null;
    const id = typeof rawId === 'string' ? rawId : rawId.toString();
    if (!id)
        return null;
    const role = plain.role === 'admin' ? 'admin' : 'user';
    const profile = (plain.profile ?? {});
    const displayName = pickString(profile, 'displayName') ?? '';
    const username = pickString(profile, 'username') ?? '';
    return {
        id,
        role,
        profile: {
            displayName,
            username,
            bio: pickString(profile, 'bio'),
            avatarUrl: pickString(profile, 'avatarUrl'),
            avatarColor: pickString(profile, 'avatarColor'),
            title: pickString(profile, 'title'),
            company: pickString(profile, 'company'),
            location: pickString(profile, 'location'),
            website: pickString(profile, 'website'),
            twitter: pickString(profile, 'twitter'),
            linkedin: pickString(profile, 'linkedin'),
            youtube: pickString(profile, 'youtube'),
            instagram: pickString(profile, 'instagram'),
            facebook: pickString(profile, 'facebook'),
        },
    };
}
//# sourceMappingURL=userPublicView.js.map