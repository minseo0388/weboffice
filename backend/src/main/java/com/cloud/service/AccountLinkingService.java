package com.cloud.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AccountLinkingService manages the unified account store (accounts.json).
 *
 * Core concept:
 *   Each "account" has a stable UUID that becomes the storage prefix key.
 *   A single account can hold both a Google identity AND a Discord identity.
 *   This allows users to log in with either provider and access the same files.
 *
 * accounts.json format:
 * {
 *   "accounts": [
 *     {
 *       "id": "uuid",
 *       "google": { "sub": "...", "email": "...", "name": "..." },
 *       "discord": { "id": "...", "username": "...", "email": "..." },
 *       "createdAt": "2026-04-28T00:00:00Z"
 *     }
 *   ]
 * }
 *
 * Thread-safety: all file read/write operations are synchronized on `this`.
 */
@Service
public class AccountLinkingService {

    @Value("${accounts.config.path:accounts.json}")
    private String accountsConfigPath;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * In-memory pending link codes: code → sourceAccountId.
     * TTL is enforced by checking createdAt on consumption.
     */
    private final ConcurrentHashMap<String, PendingLink> pendingLinks = new ConcurrentHashMap<>();

    private record PendingLink(String sourceAccountId, long createdAt) {
        boolean isExpired() {
            // 10-minute TTL
            return System.currentTimeMillis() - createdAt > 10 * 60 * 1000;
        }
    }

    @PostConstruct
    public void init() {
        File file = new File(accountsConfigPath);
        if (!file.exists()) {
            try {
                ObjectNode root = objectMapper.createObjectNode();
                root.putArray("accounts");
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, root);
                System.out.println("[AccountLinkingService] Created empty accounts.json at: " + accountsConfigPath);
            } catch (IOException e) {
                System.err.println("[AccountLinkingService] Failed to create accounts.json: " + e.getMessage());
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Finds or creates a unified account for a Google login.
     * - Searches for an account with matching google.sub.
     * - If not found: creates a new account.
     * Returns the unified account UUID.
     */
    public String findOrCreateByGoogle(String sub, String email, String name) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();

            // 1. Look for existing account with this Google sub
            for (JsonNode account : accounts) {
                if (sub.equals(account.path("google").path("sub").asText(null))) {
                    return account.get("id").asText();
                }
            }

            // 2. Not found → create new account
            String newId = UUID.randomUUID().toString();
            ObjectNode newAccount = objectMapper.createObjectNode();
            newAccount.put("id", newId);
            newAccount.put("createdAt", Instant.now().toString());

            ObjectNode googleNode = newAccount.putObject("google");
            googleNode.put("sub", sub);
            googleNode.put("email", email != null ? email : "");
            googleNode.put("name", name != null ? name : "");

            accounts.add(newAccount);
            writeAccounts(accounts);
            System.out.println("[AccountLinkingService] Created new account " + newId + " for Google sub=" + sub);
            return newId;
        }
    }

    /**
     * Finds or creates a unified account for a Discord login.
     * - Searches for an account with matching discord.id.
     * - If not found: creates a new account.
     * Returns the unified account UUID.
     */
    public String findOrCreateByDiscord(String discordId, String username, String email) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();

            // 1. Look for existing account with this Discord id
            for (JsonNode account : accounts) {
                if (discordId.equals(account.path("discord").path("id").asText(null))) {
                    return account.get("id").asText();
                }
            }

            // 2. Not found → create new account
            String newId = UUID.randomUUID().toString();
            ObjectNode newAccount = objectMapper.createObjectNode();
            newAccount.put("id", newId);
            newAccount.put("createdAt", Instant.now().toString());

            ObjectNode discordNode = newAccount.putObject("discord");
            discordNode.put("id", discordId);
            discordNode.put("username", username != null ? username : "");
            discordNode.put("email", email != null ? email : "");

            accounts.add(newAccount);
            writeAccounts(accounts);
            System.out.println("[AccountLinkingService] Created new account " + newId + " for Discord id=" + discordId);
            return newId;
        }
    }

    /**
     * Links a Google identity to an existing unified account (by accountId).
     * If the Google sub is already linked to a DIFFERENT account, throws IllegalStateException.
     */
    public void linkGoogleToAccount(String accountId, String sub, String email, String name) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();

            // Guard: ensure this Google sub isn't already owned by another account
            for (JsonNode account : accounts) {
                String existingSub = account.path("google").path("sub").asText(null);
                if (sub.equals(existingSub) && !accountId.equals(account.path("id").asText())) {
                    throw new IllegalStateException(
                        "This Google account is already linked to a different account. " +
                        "Please unlink it first."
                    );
                }
            }

            // Find target account and add Google identity
            for (JsonNode rawAccount : accounts) {
                if (accountId.equals(rawAccount.path("id").asText())) {
                    ObjectNode account = (ObjectNode) rawAccount;
                    ObjectNode googleNode = account.putObject("google");
                    googleNode.put("sub", sub);
                    googleNode.put("email", email != null ? email : "");
                    googleNode.put("name", name != null ? name : "");
                    writeAccounts(accounts);
                    System.out.println("[AccountLinkingService] Linked Google sub=" + sub + " to account " + accountId);
                    return;
                }
            }
            throw new IllegalStateException("Account not found: " + accountId);
        }
    }

    /**
     * Links a Discord identity to an existing unified account (by accountId).
     * If the Discord id is already linked to a DIFFERENT account, throws IllegalStateException.
     */
    public void linkDiscordToAccount(String accountId, String discordId, String username, String email) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();

            // Guard: ensure this Discord id isn't already owned by another account
            for (JsonNode account : accounts) {
                String existingId = account.path("discord").path("id").asText(null);
                if (discordId.equals(existingId) && !accountId.equals(account.path("id").asText())) {
                    throw new IllegalStateException(
                        "This Discord account is already linked to a different account."
                    );
                }
            }

            // Find target account and add Discord identity
            for (JsonNode rawAccount : accounts) {
                if (accountId.equals(rawAccount.path("id").asText())) {
                    ObjectNode account = (ObjectNode) rawAccount;
                    ObjectNode discordNode = account.putObject("discord");
                    discordNode.put("id", discordId);
                    discordNode.put("username", username != null ? username : "");
                    discordNode.put("email", email != null ? email : "");
                    writeAccounts(accounts);
                    System.out.println("[AccountLinkingService] Linked Discord id=" + discordId + " to account " + accountId);
                    return;
                }
            }
            throw new IllegalStateException("Account not found: " + accountId);
        }
    }

    /**
     * Reads all linked identity info for a given unified accountId.
     * Returns a map with keys: "id", "google" (sub/email/name), "discord" (id/username/email).
     */
    public Optional<Map<String, Object>> getAccountInfo(String accountId) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();
            for (JsonNode account : accounts) {
                if (accountId.equals(account.path("id").asText())) {
                    Map<String, Object> info = Map.of(
                        "id",      account.path("id").asText(""),
                        "google",  jsonNodeToMap(account.path("google")),
                        "discord", jsonNodeToMap(account.path("discord")),
                        "createdAt", account.path("createdAt").asText("")
                    );
                    return Optional.of(info);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Returns the Google email associated with a unified accountId, if any.
     * Used by UserConfigService for per-user quota lookup.
     */
    public Optional<String> getGoogleEmailForAccount(String accountId) throws IOException {
        synchronized (this) {
            ArrayNode accounts = readAccounts();
            for (JsonNode account : accounts) {
                if (accountId.equals(account.path("id").asText())) {
                    String email = account.path("google").path("email").asText(null);
                    return Optional.ofNullable(email != null && !email.isBlank() ? email : null);
                }
            }
        }
        return Optional.empty();
    }

    // ── Pending Link Codes ─────────────────────────────────────────────────────

    /**
     * Creates a one-time link code associated with sourceAccountId.
     * The code expires after 10 minutes.
     * Used in the account-linking flow: user generates a code, then logs in
     * with a second provider; that login completes the link.
     */
    public String createLinkCode(String sourceAccountId) {
        String code = UUID.randomUUID().toString().replace("-", "");
        pendingLinks.put(code, new PendingLink(sourceAccountId, System.currentTimeMillis()));
        // Purge old expired codes
        pendingLinks.entrySet().removeIf(e -> e.getValue().isExpired());
        return code;
    }

    /**
     * Consumes a pending link code and returns the associated sourceAccountId.
     * Returns empty if the code is invalid or expired.
     */
    public Optional<String> consumeLinkCode(String code) {
        PendingLink link = pendingLinks.remove(code);
        if (link == null || link.isExpired()) return Optional.empty();
        return Optional.of(link.sourceAccountId());
    }

    // ── Internal I/O ──────────────────────────────────────────────────────────

    private ArrayNode readAccounts() throws IOException {
        File file = new File(accountsConfigPath);
        if (!file.exists()) return objectMapper.createArrayNode();
        JsonNode root = objectMapper.readTree(file);
        JsonNode arr = root.path("accounts");
        return arr.isArray() ? (ArrayNode) arr : objectMapper.createArrayNode();
    }

    private void writeAccounts(ArrayNode accounts) throws IOException {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("accounts", accounts);
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(new File(accountsConfigPath), root);
    }

    private Map<String, Object> jsonNodeToMap(JsonNode node) {
        if (node == null || node.isMissingNode()) return Map.of();
        return Map.of(
            "sub",      node.path("sub").asText(""),
            "email",    node.path("email").asText(""),
            "name",     node.path("name").asText(""),
            "id",       node.path("id").asText(""),
            "username", node.path("username").asText("")
        );
    }
}
