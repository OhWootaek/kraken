package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.PlayerRole;
import com.oh.kraken.domain.game.model.PlayerState;
import lombok.Getter;

/**
 * 5-3. 게임 결과의 플레이어 정보 DTO (역할 공개)
 */
@Getter
public class PlayerResultDto {
    private final String username;
    private final PlayerRole role;

    public PlayerResultDto(PlayerState player) {
        this.username = player.getUser().getUsername();
        this.role = player.getRole();
    }
}