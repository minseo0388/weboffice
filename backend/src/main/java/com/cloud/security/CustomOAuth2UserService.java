package com.cloud.security;

import com.cloud.service.AuthService;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final AuthService authService;

    public CustomOAuth2UserService(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        if ("google".equals(registrationId)) {
            String email = oAuth2User.getAttribute("email");
            if (email == null || !authService.validateGoogleUser(email)) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("access_denied"),
                        "Google account [" + email + "] is not in the allowlist."
                );
            }
        } else if ("discord".equals(registrationId)) {
            // Discord access token is needed for Guild/Role validation
            String accessToken = userRequest.getAccessToken().getTokenValue();
            if (!authService.validateDiscordUser(accessToken)) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("access_denied"),
                        "Discord account does not have the required Guild and Role membership."
                );
            }
        } else {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unsupported_provider"),
                    "OAuth2 provider [" + registrationId + "] is not supported."
            );
        }

        return oAuth2User;
    }
}
