package com.cloud.controller;

import com.cloud.service.UserConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.cloud.model.UserPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin API for managing users.json at runtime.
 *
 * POST /api/admin/users/reload
 *   Reloads users.json from disk without restarting the server.
 *   Useful after editing the file to add/remove Google emails or change quotas.
 *   (Auth required — any logged-in user can trigger this, or you can add ROLE_ADMIN guard later)
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserConfigService userConfigService;

    public AdminController(UserConfigService userConfigService) {
        this.userConfigService = userConfigService;
    }

    /**
     * POST /api/admin/users/reload
     * Hot-reloads users.json from disk. No server restart required.
     */
    @PostMapping("/users/reload")
    public ResponseEntity<Map<String, String>> reloadUsers(@AuthenticationPrincipal UserPrincipal user) {
        userConfigService.reload();
        return ResponseEntity.ok(Map.of(
                "status",  "ok",
                "message", "users.json reloaded successfully."
        ));
    }
}
