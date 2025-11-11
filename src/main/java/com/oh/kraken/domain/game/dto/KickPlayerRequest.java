package com.oh.kraken.domain.game.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 방장이 플레이어를 강퇴할 때 /app/room/{roomCode}/kick 으로 보내는 DTO
 */
@Getter
@Setter
public class KickPlayerRequest {
    // 강퇴할 유저의 닉네임
    private String username;
}