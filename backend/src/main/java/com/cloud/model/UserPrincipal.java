package com.cloud.model;

/**
 * Represents an authenticated user principal stored in the JWT.
 * Works for both Google and Discord providers.
 *
 * accountId is the unified account UUID from accounts.json.
 * All storage operations are keyed by accountId — not by provider-specific userId —
 * so that a user logging in with either Google or Discord accesses the same files.
 */
public record UserPrincipal(
        String userId,       // Google: "sub" claim / Discord: user "id"
        String email,        // Google: email / Discord: email (if verified)
        String displayName,  // Google: name / Discord: username
        String provider,     // "google" or "discord"
        String accountId     // Unified account UUID from accounts.json
) {
    /**
     * Returns the Oracle OCI virtual directory prefix for this user's files.
     * Uses the unified accountId so that both Google and Discord logins
     * map to the same storage directory after account linking.
     * e.g. "users/550e8400-e29b-41d4-a716-446655440000/"
     */
    public String storagePrefixKey() {
        return "users/" + accountId + "/";
    }
}
