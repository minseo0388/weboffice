package com.cloud.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    @Value("${discord.required.guild.id}")
    private String requiredGuildId;

    @Value("${discord.required.role.id}")
    private String requiredRoleId;

    @Value("${google.allowlist.path:allowlist.json}")
    private String allowlistPath;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Validates Google User by checking if email exists in Allowlist JSON
     */
    public boolean validateGoogleUser(String email) {
        try {
            File file = new File(allowlistPath);
            if (!file.exists()) return false;
            
            // Allowlist is assumed to be a JSON array of strings: ["user1@gmail.com", "user2@gmail.com"]
            @SuppressWarnings("unchecked")
            List<String> allowedEmails = objectMapper.readValue(file, List.class);
            return allowedEmails.contains(email);
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Validates Discord User by verifying Guild & Role membership via Discord API
     */
    public boolean validateDiscordUser(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            // 1. Fetch user's guilds
            String guildsUrl = "https://discord.com/api/users/@me/guilds";
            @SuppressWarnings("rawtypes")
            ResponseEntity<List> guildsResponse = restTemplate.exchange(guildsUrl, HttpMethod.GET, entity, List.class);
            
            if (guildsResponse.getBody() == null) return false;
            
            boolean inGuild = false;
            for (Object g : guildsResponse.getBody()) {
                Map<String, Object> guild = (Map<String, Object>) g;
                if (requiredGuildId.equals(guild.get("id"))) {
                    inGuild = true;
                    break;
                }
            }
            if (!inGuild) return false;

            // 2. Fetch specific guild member info (to traverse roles)
            String memberUrl = "https://discord.com/api/users/@me/guilds/" + requiredGuildId + "/member";
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> memberResponse = restTemplate.exchange(memberUrl, HttpMethod.GET, entity, Map.class);
            
            if (memberResponse.getBody() == null) return false;
            
            List<String> roles = (List<String>) memberResponse.getBody().get("roles");
            return roles != null && roles.contains(requiredRoleId);

        } catch (Exception e) {
            e.printStackTrace();
            return false; // Fail secure upon runtime errors
        }
    }
}
