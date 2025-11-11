package com.oh.kraken.domain.game.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 방장이 최대 인원 수를 변경할 때 /app/room/{roomCode}/config/max-players 로 보내는 DTO
 */
@Getter
@Setter
public class ChangeMaxPlayersRequest {
    // 4, 5, 6 중 하나
    private int maxPlayers;
}