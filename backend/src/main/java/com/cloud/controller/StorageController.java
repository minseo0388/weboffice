package com.cloud.controller;

import com.cloud.model.UserPrincipal;
import com.cloud.service.StorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * REST API for per-user file operations against Oracle OCI Object Storage.
 * All endpoints are scoped to the authenticated user's virtual directory.
 * A user CANNOT access another user's files — enforced in StorageService.
 */
@RestController
@RequestMapping("/api/storage")
public class StorageController {

    private final StorageService storageService;

    public StorageController(StorageService storageService) {
        this.storageService = storageService;
    }

    /**
     * GET /api/storage/files
     * Lists all files in the authenticated user's directory.
     */
    @GetMapping("/files")
    public ResponseEntity<Map<String, Object>> listFiles(@AuthenticationPrincipal UserPrincipal user) {
        List<String> files = storageService.listUserFiles(user);
        return ResponseEntity.ok(Map.of(
                "userId", user.userId(),
                "provider", user.provider(),
                "files", files
        ));
    }

    /**
     * POST /api/storage/upload
     * Uploads a file to the authenticated user's directory.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam("file") MultipartFile file) {
        try {
            String fileName = file.getOriginalFilename();
            if (fileName == null || fileName.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File name is required."));
            }
            storageService.uploadFile(user, fileName, file);
            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded successfully.",
                    "fileName", fileName,
                    "size", String.valueOf(file.getSize())
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /**
     * GET /api/storage/download/{fileName}
     * Downloads a file from the authenticated user's directory as an octet-stream.
     */
    @GetMapping("/download/{fileName}")
    public ResponseEntity<byte[]> downloadFile(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String fileName) {
        try {
            InputStream stream = storageService.downloadFile(user, fileName);
            byte[] bytes = stream.readAllBytes();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * DELETE /api/storage/delete/{fileName}
     * Deletes a file from the authenticated user's directory.
     */
    @DeleteMapping("/delete/{fileName}")
    public ResponseEntity<Map<String, String>> deleteFile(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable String fileName) {
        try {
            storageService.deleteFile(user, fileName);
            return ResponseEntity.ok(Map.of("message", "File deleted.", "fileName", fileName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Delete failed: " + e.getMessage()));
        }
    }

    /**
     * GET /api/storage/usage
     * Returns actual Oracle OCI storage usage for the authenticated user.
     * Iterates all objects in the user's prefix with size fields enabled.
     * Response: { usedBytes: long, fileCount: int, usedFormatted: "1.23 GB" }
     */
    @GetMapping("/usage")
    public ResponseEntity<Map<String, Object>> getUsage(@AuthenticationPrincipal UserPrincipal user) {
        try {
            StorageService.StorageStats stats = storageService.getUsageStats(user);
            return ResponseEntity.ok(Map.of(
                    "usedBytes",     stats.usedBytes(),
                    "fileCount",     stats.fileCount(),
                    "usedFormatted", formatBytes(stats.usedBytes())
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to retrieve usage: " + e.getMessage()));
        }
    }

    /** Converts raw bytes to a human-readable string (KB / MB / GB). */
    private String formatBytes(long bytes) {
        if (bytes < 1024)            return bytes + " B";
        if (bytes < 1024 * 1024)    return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.2f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }
}

