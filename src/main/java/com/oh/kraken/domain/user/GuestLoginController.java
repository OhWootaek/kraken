package com.oh.kraken.domain.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Controller
@RequiredArgsConstructor
public class GuestLoginController {

    private final GuestLoginService guestLoginService;

    @PostMapping("/login/guest")
    public String guestLogin(
            @RequestParam String username,
            HttpServletRequest request,
            HttpServletResponse response) {

        // 1. 닉네임으로 유저를 찾거나 생성
        User user = guestLoginService.loginOrRegister(username);

        // 2. 수동으로 OAuth2User Principal 생성
        // (기존 컨트롤러들이 @AuthenticationPrincipal OAuth2User를 사용하기 때문)
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("email", user.getEmail());
        attributes.put("username", user.getUsername());
        attributes.put("name", user.getUsername()); // (구글 'name' 속성 흉내)

        Set<GrantedAuthority> authorities = Collections.singleton(
                new SimpleGrantedAuthority(user.getRole().name())
        );

        OAuth2User principal = new DefaultOAuth2User(authorities, attributes, "email");

        // 3. 수동으로 Authentication 객체 생성
        Authentication authentication = new OAuth2AuthenticationToken(
                principal,
                authorities,
                "guest" // "google" 대신 "guest"
        );

        // 4. SecurityContext에 수동으로 인증 정보 주입
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        // 5. 세션에 인증 정보 저장 (중요)
        HttpSessionSecurityContextRepository repo = new HttpSessionSecurityContextRepository();
        repo.saveContext(context, request, response);

        // 6. 로비로 리다이렉트
        return "redirect:/lobby";
    }
}