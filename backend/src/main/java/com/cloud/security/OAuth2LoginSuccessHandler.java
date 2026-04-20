package com.cloud.security;

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

@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Value("${jwt.secret.key}")
    private String secretKey;

    @Value("${frontend.redirect.url:http://localhost:3000/dashboard}")
    private String frontendRedirectUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oAuth2User = oauthToken.getPrincipal();

        // Determine which provider was used
        String provider = oauthToken.getAuthorizedClientRegistrationId(); // "google" or "discord"

        // Resolve stable unique ID and display name
        String userId;
        String displayName;
        if ("google".equals(provider)) {
            userId = oAuth2User.getAttribute("sub"); // Google's stable unique ID
            displayName = oAuth2User.getAttribute("name");
        } else { // discord
            Object idAttr = oAuth2User.getAttribute("id");
            userId = idAttr != null ? idAttr.toString() : "unknown";
            displayName = oAuth2User.getAttribute("username");
        }

        String email = oAuth2User.getAttribute("email");

        // Issue a JWT valid for 24 hours
        long nowMillis = System.currentTimeMillis();
        String jwt = Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("name", displayName)
                .claim("provider", provider)
                .claim("role", "USER")
                .issuedAt(new Date(nowMillis))
                .expiration(new Date(nowMillis + 86_400_000L)) // 24h
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8)))
                .compact();

        // Redirect to frontend dashboard with token in query param
        String redirectUrl = frontendRedirectUrl + "?token=" + jwt;
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
