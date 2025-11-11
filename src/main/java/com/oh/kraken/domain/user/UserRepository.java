package com.oh.kraken.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // 1. OAuth2 로그인 시 email을 기준으로 유저 조회
    Optional<User> findByEmail(String email);

    // 2. username 등록 시 중복 확인
    boolean existsByUsername(String username);

    // ⭐️ [추가] 게스트 로그인 시 username으로 유저 조회
    Optional<User> findByUsername(String username);
}
