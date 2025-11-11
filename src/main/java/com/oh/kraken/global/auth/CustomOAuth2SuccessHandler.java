package com.oh.kraken.global.auth;

import com.oh.kraken.domain.user.Role;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.domain.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class CustomOAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository; // 간단한 조회를 위해 Repository 직접 사용

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        // DB에서 유저의 Role을 다시 확인
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found in DB"));

        String targetUrl;
        if (user.getRole() == Role.ROLE_GUEST) {
            // ⭐️ 최초 로그인이면 닉네임 등록 페이지로
            targetUrl = "/register-username";
        } else {
            // ⭐️ 이미 등록된 유저면 로비로
            targetUrl = "/lobby";
        }

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}