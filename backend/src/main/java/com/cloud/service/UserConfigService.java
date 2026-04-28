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
 * Quota lookup priority:
 *   1. Look up by Google email via users.json (if the unified account has a Google identity)
 *   2. Fall back to global ${storage.quota-bytes}
 *
 * The AccountLinkingService provides the Google email for a unified accountId.
 *
 * users.json format:
 * {
 *   "users": [
 *     { "email": "alice@gmail.com", "quotaBytes": 3221225472 },
 *     { "email": "bob@gmail.com",   "quotaBytes": 10737418240 },
 *     { "email": "vip@gmail.com",   "quotaBytes": -1 }
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
    private final AccountLinkingService accountLinkingService;

    private JsonNode usersConfig;

    public UserConfigService(AccountLinkingService accountLinkingService) {
        this.accountLinkingService = accountLinkingService;
    }

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
            System.out.println("[UserConfigService] Loaded users.json: "
                    + usersConfig.path("users").size() + " entries.");
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
     * Returns the storage quota for a unified account.
     *
     * Lookup chain:
     *   1. If the account has a linked Google email → look it up in users.json
     *   2. Otherwise → return global default
     *
     * This ensures Discord-only accounts still inherit a quota if they later
     * link a Google account that has a custom quota in users.json.
     */
    public long getQuotaForAccount(String accountId) {
        try {
            Optional<String> googleEmail = accountLinkingService.getGoogleEmailForAccount(accountId);
            if (googleEmail.isPresent()) {
                return getQuotaForEmail(googleEmail.get());
            }
        } catch (IOException e) {
            System.err.println("[UserConfigService] Error reading accounts.json: " + e.getMessage());
        }
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
