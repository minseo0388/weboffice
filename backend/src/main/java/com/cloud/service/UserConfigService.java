package com.cloud.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.Optional;

/**
 * UserConfigService reads users.json to provide per-user configuration:
 *   - Google login allowlist (only listed emails may authenticate)
 *   - Per-user storage quota (quotaBytes per entry, -1 = unlimited)
 *
 * File path is configured via ${users.config.path} in application.yml.
 * Falls back to the global ${storage.quota-bytes} if a user has no explicit quota.
 *
 * users.json format:
 * {
 *   "users": [
 *     { "email": "alice@gmail.com", "quotaBytes": 3221225472 },
 *     { "email": "bob@gmail.com",   "quotaBytes": 10737418240 },
 *     { "email": "vip@gmail.com",   "quotaBytes": -1 }   <- unlimited
 *   ]
 * }
 */
@Service
public class UserConfigService {

    @Value("${users.config.path:users.json}")
    private String usersConfigPath;

    @Value("${storage.quota-bytes:3221225472}")
    private long defaultQuotaBytes;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private JsonNode usersConfig;

    @PostConstruct
    public void load() {
        reload();
    }

    /**
     * Reloads users.json from disk. Can be called at runtime
     * to apply changes without restarting the server.
     */
    public synchronized void reload() {
        try {
            File file = new File(usersConfigPath);
            if (!file.exists()) {
                System.err.println("[UserConfigService] users.json not found at: " + usersConfigPath);
                usersConfig = null;
                return;
            }
            usersConfig = objectMapper.readTree(file);
            System.out.println("[UserConfigService] Loaded users.json: " + usersConfig.path("users").size() + " entries.");
        } catch (IOException e) {
            System.err.println("[UserConfigService] Failed to parse users.json: " + e.getMessage());
            usersConfig = null;
        }
    }

    /**
     * Returns true if the given Google email is allowed to log in.
     * An email is allowed when it appears in the "users" array of users.json.
     */
    public boolean isGoogleEmailAllowed(String email) {
        if (email == null) return false;
        return findUserNode(email).isPresent();
    }

    /**
     * Returns the storage quota in bytes for a given Google email.
     * - If the user has an explicit "quotaBytes" of -1: unlimited (Long.MAX_VALUE)
     * - If the user has no explicit "quotaBytes": falls back to the global default
     * - If the user is not found: returns the global default
     */
    public long getQuotaForEmail(String email) {
        Optional<JsonNode> nodeOpt = findUserNode(email);
        if (nodeOpt.isEmpty()) return defaultQuotaBytes;

        JsonNode userNode = nodeOpt.get();
        if (!userNode.has("quotaBytes")) return defaultQuotaBytes;

        long quota = userNode.get("quotaBytes").asLong();
        return quota == -1L ? Long.MAX_VALUE : quota;
    }

    /**
     * Returns the storage quota for a user identified by provider + userId.
     * For Google users, the email stored in the JWT claim is used for lookup.
     * Discord users always get the global default (Discord auth is role-based, not email-based).
     */
    public long getQuotaForUser(String provider, String email) {
        if ("google".equals(provider) && email != null) {
            return getQuotaForEmail(email);
        }
        // Discord: no per-user quota support yet — use global default
        return defaultQuotaBytes;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private Optional<JsonNode> findUserNode(String email) {
        if (usersConfig == null) return Optional.empty();
        JsonNode users = usersConfig.path("users");
        if (!users.isArray()) return Optional.empty();

        for (JsonNode node : users) {
            if (email.equalsIgnoreCase(node.path("email").asText())) {
                return Optional.of(node);
            }
        }
        return Optional.empty();
    }
}
