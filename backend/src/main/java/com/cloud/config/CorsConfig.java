package com.cloud.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * CORS configuration for the Spring Boot backend.
 * Allows the Next.js frontend (localhost:3000 or your production domain)
 * to make cross-origin requests with the Authorization header.
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        // Allow the Next.js dev server and production domain
        config.setAllowedOriginPatterns(List.of(
                "http://localhost:3000",
                "https://*.nip.io",          // Oracle Cloud IP-based domains
                "https://naesung.kr",
                "https://*.naesung.kr",
                "${cors.allowed.origins:}"   // Customizable via env var in production
        ));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/oauth2/**", config);
        source.registerCorsConfiguration("/login/**", config);

        return new CorsFilter(source);
    }
}
