package com.oh.kraken.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    // 1. 닉네임 등록 (GUEST -> USER)
    @Transactional
    public void registerUsername(String email, String username) {
        // 1-1. 유효성 검사
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        // 1-2. DB 업데이트 (Role: GUEST -> USER)
        user.updateUsernameAndRole(username);
        userRepository.save(user);

        // 1-3. 현재 세션의 권한도 GUEST -> USER로 즉시 업데이트
        // (이걸 안 하면 로그아웃/재로그인해야 권한이 갱신됨)
        Authentication currentAuth = SecurityContextHolder.getContext().getAuthentication();

        // Principal 객체는 그대로 사용
        OAuth2User oAuth2User = (OAuth2User) currentAuth.getPrincipal();

        Map<String, Object> newAttributes = new HashMap<>(oAuth2User.getAttributes());
        newAttributes.put("username", username); // 새로 등록한 닉네임 추가;

        // 새 attributes와 새 권한으로 Principal 객체 새로 생성
        DefaultOAuth2User newOAuth2User = new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority(Role.ROLE_USER.name())),
                newAttributes,
                "email"
        );

        // 새 Principal로 인증 토큰(Authentication)을 새로 만듦
        Authentication newAuth = new OAuth2AuthenticationToken(
                newOAuth2User,
                newOAuth2User.getAuthorities(),
                ((OAuth2AuthenticationToken) currentAuth).getAuthorizedClientRegistrationId()
        );

        SecurityContextHolder.getContext().setAuthentication(newAuth);
    }

    // 2. 닉네임 변경
    @Transactional
    public void updateUsername(String email, String newUsername) {
        // 2-1. 중복 검사
        if (userRepository.existsByUsername(newUsername)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        // 2-2. 유저 조회 및 업데이트
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        // User 엔티티에 단순 setter 대신 의미 있는 메서드를 추가
        user.updateUsername(newUsername);
        // userRepository.save(user); // @Transactional 덕분에 생략 가능 (Dirty Checking)
    }

    // 3. 회원 탈퇴
    @Transactional
    public void deleteUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        userRepository.delete(user);

        // 탈퇴 후 세션 무효화 (로그아웃 처리)
        SecurityContextHolder.clearContext();
    }
}