package com.oh.kraken.domain.user;

// GUEST: 구글 로그인은 했으나, username은 미설정
// USER: username까지 설정한 정식 회원
public enum Role {
    ROLE_GUEST, ROLE_USER, ROLE_ADMIN
}
