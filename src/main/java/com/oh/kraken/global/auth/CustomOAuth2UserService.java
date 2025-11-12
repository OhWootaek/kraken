package com.oh.kraken.global.auth;

import com.oh.kraken.domain.user.Role;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // 1. 기본 OAuth2 유저 정보 로드
        OAuth2User oAuth2User = super.loadUser(userRequest);

        // 2. 핵심 정보 추출
        Map<String, Object> attributes = oAuth2User.getAttributes();
        String email = (String) attributes.get("email");
        String provider = userRequest.getClientRegistration().getRegistrationId();

        // 3. DB에서 유저 조회 또는 생성
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> saveNewUser(email, provider));

        // attributes 맵 복사 후, DB의 username 추가
        Map<String, Object> customAttributes = new HashMap<>(attributes);
        customAttributes.put("username", user.getUsername()); // GUEST는 null이 들어감 (정상)

        // 4. Spring Security가 관리할 Principal 객체 반환
        // (email을 nameAttributeKey로 사용)
        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority(user.getRole().name())),
                customAttributes,
                "email" // nameAttributeKey
        );
    }

    private User saveNewUser(String email, String provider) {
        User newUser = User.builder()
                .email(email)
                .role(Role.ROLE_GUEST)
                .provider(provider)
                .build();
        return userRepository.save(newUser);
    }
}
