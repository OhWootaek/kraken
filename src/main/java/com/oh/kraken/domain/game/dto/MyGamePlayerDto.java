package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.CardType;
import com.oh.kraken.domain.game.model.PlayerRole;
import com.oh.kraken.domain.game.model.PlayerState;
import lombok.Getter;

import java.util.List;

/**
 * 4-2. 1:1 전송용 DTO (나의 비밀 정보 포함)
 */
@Getter
public class MyGamePlayerDto extends InGamePlayerDto {
    private PlayerRole myRole; // 나의 역할
    private List<CardType> myHand; // 나의 손패 (1라운드: 5장)

    /**
     * 부모 생성자에 'requestingUserId' 전달
     * @param player PlayerState 객체
     * @param requestingUserId 이 DTO를 요청한 유저의 ID (즉, "나")
     */
    public MyGamePlayerDto(PlayerState player, Long requestingUserId) {
        super(player, requestingUserId); // 부모 생성자 호출
        this.myRole = player.getRole();
        this.myHand = player.getHand();
    }
}