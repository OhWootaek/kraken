package com.oh.kraken.domain.game.model;

import lombok.Getter;
import java.util.UUID;

/**
 * 4-2. 리팩토링: 플레이어 보드에 깔리는 카드 1장의 객체 (상태 저장)
 */
@Getter
public class PlayerCard {
    private final String cardId; // ⭐️ DOM에서 식별하기 위한 고유 ID
    private final CardType type;
    private boolean isRevealed;

    public PlayerCard(CardType type) {
        this.cardId = UUID.randomUUID().toString(); // 고유 ID 생성
        this.type = type;
        this.isRevealed = false; // 기본은 뒷면
    }

    // ⭐️ [FIX] 카드를 "제거"하는 대신 "뒤집음"
    public void reveal() {
        this.isRevealed = true;
    }
}