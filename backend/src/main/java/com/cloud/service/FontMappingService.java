package com.cloud.service;

import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Maps proprietary HWP font names to open-source alternatives available on the server.
 *
 * Strategy:
 *  1. hwplib reads the original font name from the HWP/HWPX binary.
 *  2. This service substitutes it with an installed open-source font.
 *  3. The browser uses the same logical name via @font-face (WOFF2) served from /public/fonts/.
 *
 * This ensures layout metric consistency between server-side rendering (hwplib)
 * and client-side display (browser WOFF2).
 */
@Service
public class FontMappingService {

    /**
     * Font substitution table.
     * Key: Original proprietary/HWP font name (as stored in HWP binary)
     * Value: Open-source alternative installed on the Ubuntu server + served as WOFF2
     */
    private static final Map<String, String> FONT_MAP = Map.ofEntries(
            // HWP default fonts (Hancom proprietary)
            Map.entry("HY신명조",         "NanumMyeongjo"),
            Map.entry("HY헤드라인M",       "NanumGothic"),
            Map.entry("HY중고딕",          "NanumGothic"),
            Map.entry("HY강B",            "NanumGothicBold"),
            Map.entry("HY그래픽",         "NanumGothic"),
            Map.entry("바탕",             "NanumMyeongjo"),
            Map.entry("바탕체",            "NanumMyeongjo"),
            Map.entry("굴림",             "NanumGothic"),
            Map.entry("굴림체",            "NanumGothic"),
            Map.entry("돋움",             "NanumGothic"),
            Map.entry("돋움체",            "NanumGothic"),
            Map.entry("궁서",             "UnBatang"),
            Map.entry("궁서체",            "UnBatang"),
            Map.entry("맑은 고딕",         "NanumGothic"),
            Map.entry("나눔고딕",          "NanumGothic"),
            Map.entry("나눔명조",          "NanumMyeongjo"),

            // Hamchorom series (popular in HWP documents)
            Map.entry("함초롬바탕",        "HamchoromBatang"),
            Map.entry("함초롬돋움",        "HamchoromDotum"),

            // Latin fallbacks
            Map.entry("Times New Roman",   "NanumMyeongjo"),
            Map.entry("Arial",             "NanumGothic"),
            Map.entry("Calibri",           "NanumGothic")
    );

    /** Default fallback when no mapping exists */
    private static final String DEFAULT_FONT = "NanumGothic";

    /**
     * Returns the open-source font name for a given original HWP font name.
     */
    public String resolve(String originalFontName) {
        if (originalFontName == null || originalFontName.isBlank()) {
            return DEFAULT_FONT;
        }
        return FONT_MAP.getOrDefault(originalFontName.trim(), DEFAULT_FONT);
    }

    /**
     * Returns the full font map for frontend initialization
     * (so the editor can apply the same substitution client-side).
     */
    public Map<String, String> getFullMap() {
        return FONT_MAP;
    }
}
