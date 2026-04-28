package com.cloud.controller;

import com.cloud.model.UserPrincipal;
import com.cloud.service.AccountLinkingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * AccountController provides REST endpoints for unified account management:
 *
 *   GET  /api/account/me
 *     Returns the current user's linked identities (Google + Discord).
 *
 *   POST /api/account/link/start?targetProvider=discord
 *     Generates a one-time link code for the current user.
 *     The frontend uses this code to initiate an OAuth2 flow that will
 *     link the new identity to the current account instead of creating a new one.
 *
 *     Flow:
 *       1. Frontend: POST /api/account/link/start?targetProvider=discord  (with Bearer JWT)
 *       2. Backend: creates link code, returns { linkCode, redirectUrl }
 *       3. Frontend: stores linkCode in sessionStorage, navigates to redirectUrl
 *       4. OAuth2 flow completes → redirected to /dashboard?token=<newJWT>
 *       5. Frontend: if sessionStorage has linkCode, POST /api/account/link/complete
 *       6. Backend: consumes code, links identity, issues new merged JWT
 *
 *   POST /api/account/link/complete
 *     Body: { "linkCode": "..." }
 *     The CURRENT JWT must belong to the NEWLY logged-in provider.
 *     The link code identifies the ORIGINAL account to merge into.
 *
 *   POST /api/admin/users/reload  (in AdminController)
 *     Hot-reloads users.json.
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final AccountLinkingService accountLinkingService;

    public AccountController(AccountLinkingService accountLinkingService) {
        this.accountLinkingService = accountLinkingService;
    }

    /**
     * GET /api/account/me
     * Returns linked Google + Discord identities for the current account.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@AuthenticationPrincipal UserPrincipal user) {
        try {
            Optional<Map<String, Object>> info = accountLinkingService.getAccountInfo(user.accountId());
            if (info.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                    "accountId", user.accountId(),
                    "provider",  user.provider(),
                    "email",     user.email() != null ? user.email() : "",
                    "name",      user.displayName() != null ? user.displayName() : "",
                    "google",    Map.of(),
                    "discord",   Map.of()
                ));
            }
            Map<String, Object> result = info.get();
            return ResponseEntity.ok(Map.of(
                "accountId", result.get("id"),
                "google",    result.get("google"),
                "discord",   result.get("discord"),
                "createdAt", result.get("createdAt")
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to retrieve account info: " + e.getMessage()));
        }
    }

    /**
     * POST /api/account/link/start?targetProvider=google|discord
     * Generates a one-time link code (10-minute TTL).
     * Returns { linkCode, redirectUrl } for the frontend to initiate the OAuth2 flow.
     */
    @PostMapping("/link/start")
    public ResponseEntity<Map<String, String>> startLink(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam String targetProvider) {

        if (!"google".equals(targetProvider) && !"discord".equals(targetProvider)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "targetProvider must be 'google' or 'discord'."));
        }

        if (user.provider().equals(targetProvider)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "You are already logged in with " + targetProvider + "."));
        }

        String linkCode = accountLinkingService.createLinkCode(user.accountId());
        String redirectUrl = "/oauth2/authorization/" + targetProvider;

        return ResponseEntity.ok(Map.of(
                "linkCode",    linkCode,
                "redirectUrl", redirectUrl,
                "message",     "Navigate to redirectUrl to link your " + targetProvider + " account."
        ));
    }

    /**
     * POST /api/account/link/complete
     * Body: { "linkCode": "...", "provider": "...", "userId": "...", "displayName": "...", "email": "..." }
     *
     * Called AFTER the second OAuth2 login completes.
     * The current JWT (Bearer) identifies the NEWLY authenticated identity.
     * The linkCode identifies the ORIGINAL account to link into.
     *
     * This is the client-side coordination step:
     *   - Frontend has a new JWT from the second login
     *   - Frontend also has a linkCode from the first account
     *   - This endpoint merges them server-side
     *
     * Returns a NEW unified JWT for the merged account.
     */
    @PostMapping("/link/complete")
    public ResponseEntity<Map<String, Object>> completeLink(
            @AuthenticationPrincipal UserPrincipal newIdentityUser,
            @RequestBody Map<String, String> body) {

        String linkCode = body.get("linkCode");
        if (linkCode == null || linkCode.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "linkCode is required."));
        }

        Optional<String> sourceAccountIdOpt = accountLinkingService.consumeLinkCode(linkCode);
        if (sourceAccountIdOpt.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Link code is invalid or expired. Please start the linking process again."));
        }

        String sourceAccountId = sourceAccountIdOpt.get();

        // Safety: if both tokens already point to the same account, nothing to do.
        if (sourceAccountId.equals(newIdentityUser.accountId())) {
            return ResponseEntity.ok(Map.of(
                    "status",    "already_linked",
                    "accountId", sourceAccountId
            ));
        }

        try {
            if ("google".equals(newIdentityUser.provider())) {
                accountLinkingService.linkGoogleToAccount(
                        sourceAccountId,
                        newIdentityUser.userId(),
                        newIdentityUser.email(),
                        newIdentityUser.displayName()
                );
            } else {
                accountLinkingService.linkDiscordToAccount(
                        sourceAccountId,
                        newIdentityUser.userId(),
                        newIdentityUser.displayName(),
                        newIdentityUser.email()
                );
            }

            return ResponseEntity.ok(Map.of(
                    "status",    "linked",
                    "accountId", sourceAccountId,
                    "message",   newIdentityUser.provider() + " account linked successfully. " +
                                 "Please log in again to get a fresh token for the merged account."
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Linking failed: " + e.getMessage()));
        }
    }
}
