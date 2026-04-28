package com.cloud.security;

import com.cloud.service.AccountLinkingService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

/**
 * OAuth2LoginSuccessHandler issues a JWT after a successful OAuth2 login.
 *
 * Account flow:
 *   1. Normal login: findOrCreate a unified account via AccountLinkingService.
 *      The resulting accountId is embedded in the JWT.
 *
 *   2. Account linking: if the request carries a "link_code" parameter, the
 *      newly authenticated identity is linked to the EXISTING account that
 *      generated the code. No new account is created.
 *
 * The accountId in the JWT determines the storage prefix, so both
 * Google and Discord logins access the same OCI directory after linking.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Value("${jwt.secret.key}")
    private String secretKey;

    @Value("${frontend.redirect.url:http://localhost:3000/dashboard}")
    private String frontendRedirectUrl;

    private final AccountLinkingService accountLinkingService;

    public OAuth2LoginSuccessHandler(AccountLinkingService accountLinkingService) {
        this.accountLinkingService = accountLinkingService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oAuth2User = oauthToken.getPrincipal();

        String provider = oauthToken.getAuthorizedClientRegistrationId(); // "google" or "discord"

        // ── Resolve provider-specific identity fields ──────────────────────────
        String userId;
        String displayName;
        String email = oAuth2User.getAttribute("email");

        if ("google".equals(provider)) {
            userId      = oAuth2User.getAttribute("sub");
            displayName = oAuth2User.getAttribute("name");
        } else { // discord
            Object idAttr = oAuth2User.getAttribute("id");
            userId      = idAttr != null ? idAttr.toString() : "unknown";
            displayName = oAuth2User.getAttribute("username");
        }

        // ── Check for pending link code in the HTTP session ────────────────────
        // Frontend stores the code in the session before starting the OAuth2 flow.
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        String linkCode = (session != null)
                ? (String) session.getAttribute("pending_link_code")
                : null;

        // Also accept link_code via query param (set before OAuth2 redirect via /api/account/link/start)
        if (linkCode == null) {
            linkCode = request.getParameter("link_code");
        }

        String accountId;

        if (linkCode != null && !linkCode.isBlank()) {
            // ── Account linking flow ───────────────────────────────────────────
            Optional<String> sourceAccountId = accountLinkingService.consumeLinkCode(linkCode);

            if (sourceAccountId.isPresent()) {
                accountId = sourceAccountId.get();
                try {
                    if ("google".equals(provider)) {
                        accountLinkingService.linkGoogleToAccount(accountId, userId, email, displayName);
                    } else {
                        accountLinkingService.linkDiscordToAccount(accountId, userId, displayName, email);
                    }
                    System.out.println("[OAuth2] Linked " + provider + " identity to account " + accountId);
                } catch (IllegalStateException e) {
                    // Already linked to another account — fall through to normal login
                    System.err.println("[OAuth2] Link failed: " + e.getMessage() + " — logging in normally.");
                    accountId = resolveAccountId(provider, userId, displayName, email);
                }
            } else {
                // Invalid or expired link code — treat as normal login
                System.err.println("[OAuth2] Link code invalid/expired, treating as normal login.");
                accountId = resolveAccountId(provider, userId, displayName, email);
            }

            // Clear session attribute after use
            if (request.getSession(false) != null) {
                request.getSession().removeAttribute("pending_link_code");
            }
        } else {
            // ── Normal login flow ─────────────────────────────────────────────
            accountId = resolveAccountId(provider, userId, displayName, email);
        }

        // ── Issue JWT valid for 24 hours ───────────────────────────────────────
        long nowMillis = System.currentTimeMillis();
        String jwt = Jwts.builder()
                .subject(userId)
                .claim("email",     email)
                .claim("name",      displayName)
                .claim("provider",  provider)
                .claim("accountId", accountId)   // ← unified account UUID
                .claim("role",      "USER")
                .issuedAt(new Date(nowMillis))
                .expiration(new Date(nowMillis + 86_400_000L)) // 24h
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8)))
                .compact();

        String redirectUrl = frontendRedirectUrl + "?token=" + jwt;
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    // ── Helper ─────────────────────────────────────────────────────────────────

    private String resolveAccountId(String provider, String userId, String displayName, String email)
            throws IOException {
        if ("google".equals(provider)) {
            return accountLinkingService.findOrCreateByGoogle(userId, email, displayName);
        } else {
            return accountLinkingService.findOrCreateByDiscord(userId, displayName, email);
        }
    }
}
