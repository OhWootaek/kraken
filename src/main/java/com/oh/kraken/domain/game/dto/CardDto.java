package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.CardType;
import com.oh.kraken.domain.game.model.PlayerCard;
import lombok.Getter;

/**
 * 4-2. 깔린 카드 1장 (공용 정보)
 */
@Getter
public class CardDto {
    private final String cardId;
    private final boolean isMine; // 내 카드인지 여부
    private final boolean isRevealed; // 뒤집혔는지 여부
    // 뒤집힌 카드(isRevealed=true)일 때만 카드 타입 전송
    private final CardType cardType;
    private final boolean isKraken;
    private final boolean isTreasure;

    /**
     * 생성자가 PlayerCard와 isMine을 받도록 수정
     */
    public CardDto(PlayerCard card, boolean isMine) {
        this.cardId = card.getCardId();
        this.isMine = isMine;
        this.isRevealed = card.isRevealed();

        if (this.isRevealed) {
            // 뒤집혔으면 카드 정보 공개
            this.cardType = card.getType();
            this.isKraken = card.getType().isKraken();
            this.isTreasure = card.getType().isTreasure();
        } else {
            // 뒷면이면 카드 정보 숨김
            this.cardType = null;
            this.isKraken = false;
            this.isTreasure = false;
        }
    }
}