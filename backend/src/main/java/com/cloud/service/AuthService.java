package com.cloud.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * AuthService handles OAuth2 post-login validation.
 *
 * Google:  delegates to UserConfigService which reads users.json allowlist.
 * Discord: validates Guild + Role membership via Discord REST API.
 */
@Service
public class AuthService {

    @Value("${discord.required.guild.id}")
    private String requiredGuildId;

    @Value("${discord.required.role.id}")
    private String requiredRoleId;

    private final UserConfigService userConfigService;
    private final RestTemplate restTemplate = new RestTemplate();

    public AuthService(UserConfigService userConfigService) {
        this.userConfigService = userConfigService;
    }

    /**
     * Validates a Google user by checking if their email exists in users.json.
     * Returns true only if the email is found in the allowlist.
     */
    public boolean validateGoogleUser(String email) {
        return userConfigService.isGoogleEmailAllowed(email);
    }

    /**
     * Validates a Discord user by verifying Guild & Role membership via Discord API.
     */
    @SuppressWarnings({"null", "unchecked"})
    public boolean validateDiscordUser(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            // 1. Fetch user's guilds
            String guildsUrl = "https://discord.com/api/users/@me/guilds";
            ResponseEntity<List<Map<String, Object>>> guildsResponse = restTemplate.exchange(
                    guildsUrl,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );

            List<Map<String, Object>> guilds = guildsResponse.getBody();
            if (guilds == null) return false;

            boolean inGuild = false;
            for (Map<String, Object> guild : guilds) {
                if (requiredGuildId.equals(guild.get("id"))) {
                    inGuild = true;
                    break;
                }
            }
            if (!inGuild) return false;

            // 2. Fetch specific guild member info (to traverse roles)
            String memberUrl = "https://discord.com/api/users/@me/guilds/" + requiredGuildId + "/member";
            ResponseEntity<Map<String, Object>> memberResponse = restTemplate.exchange(
                    memberUrl,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            Map<String, Object> memberInfo = memberResponse.getBody();
            if (memberInfo == null) return false;

            List<String> roles = (List<String>) memberInfo.get("roles");
            return roles != null && roles.contains(requiredRoleId);

        } catch (Exception e) {
            e.printStackTrace();
            return false; // Fail secure upon runtime errors
        }
    }
}
