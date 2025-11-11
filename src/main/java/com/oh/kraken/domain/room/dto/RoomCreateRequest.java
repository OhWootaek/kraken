package com.oh.kraken.domain.room.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomCreateRequest {
    private String title;       // 방 제목
    private String password;    // 비밀번호 (공개방은 null 또는 빈 문자열)
    private int maxPlayers;     // 최대 인원 (4, 5, 6)
}