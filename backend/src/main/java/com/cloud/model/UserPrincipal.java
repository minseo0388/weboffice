package com.cloud.model;

/**
 * Represents an authenticated user principal stored in the JWT.
 * Works for both Google and Discord providers.
 */
public record UserPrincipal(
        String userId,       // Google: "sub" claim / Discord: user "id"
        String email,        // Google: email / Discord: email (if verified)
        String displayName,  // Google: name / Discord: username
        String provider      // "google" or "discord"
) {
    /**
     * Returns the Oracle OCI virtual directory prefix for this user's files.
     * e.g. "users/google_12345/" or "users/discord_98765/"
     */
    public String storagePrefixKey() {
        return "users/" + provider + "_" + userId + "/";
    }
}
