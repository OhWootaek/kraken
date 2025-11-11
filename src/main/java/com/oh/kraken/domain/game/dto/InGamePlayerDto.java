package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.PlayerState;
import lombok.Getter;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 4-2. 게임에 참여중인 플레이어 (공용 정보)
 */
@Getter
public class InGamePlayerDto {
    private Long userId;
    private String username;
    private int cardCount; // 현재 깔린 카드 수
    private List<CardDto> placedCards; // 깔린 카드 상태 (공개/비공개)

    /**
     * ⭐️ [FIX] 생성자에 'requestingUserId' 추가
     * @param player PlayerState 객체
     * @param requestingUserId 이 DTO를 요청한 유저의 ID
     */
    public InGamePlayerDto(PlayerState player, Long requestingUserId) {
        this.userId = player.getPlayerUserId();
        this.username = player.getUser().getUsername();

        // ⭐️ [FIX] CardDto 생성자에 (card, isMine) 2개 인자 전달
        this.placedCards = player.getPlacedCards().stream()
                .map(card -> new CardDto(card, player.getPlayerUserId().equals(requestingUserId)))
                .collect(Collectors.toList());

        // ⭐️ "남은 카드 수" 계산
        this.cardCount = (int) player.getPlacedCards().stream()
                .filter(card -> !card.isRevealed())
                .count();
    }
}