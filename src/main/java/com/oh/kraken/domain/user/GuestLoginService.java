package com.oh.kraken.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GuestLoginService {

    private final UserRepository userRepository;

    @Transactional
    public User loginOrRegister(String username) {
        // 1. 닉네임으로 유저를 찾습니다.
        Optional<User> existingUser = userRepository.findByUsername(username);
        if (existingUser.isPresent()) {
            return existingUser.get(); // 이미 있으면 해당 유저 반환
        }

        // 2. 닉네임이 없으면 새로 생성합니다.
        // (테스트용이므로, "username@guest.local" 같은 고유한 이메일을 생성)
        String fakeEmail = username + "@guest.local";

        // (예외 처리: 혹시 모를 이메일 중복 방지)
        if (userRepository.findByEmail(fakeEmail).isPresent()) {
            throw new IllegalStateException("이미 사용 중인 닉네임입니다. (Email Conflict)");
        }

        User newUser = User.builder()
                .email(fakeEmail)
                .provider("guest") // provider를 "guest"로 설정
                .role(Role.ROLE_GUEST) // ⭐️ 중요: GUEST로 생성
                .build();

        // ⭐️ updateUsernameAndRole을 호출하여 ROLE_USER로 즉시 승격
        newUser.updateUsernameAndRole(username);

        return userRepository.save(newUser);
    }
}