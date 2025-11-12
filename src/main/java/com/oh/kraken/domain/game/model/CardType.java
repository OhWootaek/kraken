package com.oh.kraken.domain.game.model;

import lombok.Getter;

@Getter
public enum CardType {
    KRAKEN(false, true, "크라켄"),
    TREASURE(true, false, "보물"),
    EMPTY_BOX(false, false, "빈 상자");

    // 4-3: 카드 타입 메타 정보
    private final boolean isTreasure;
    private final boolean isKraken;
    private final String displayName;

    CardType(boolean isTreasure, boolean isKraken, String displayName) {
        this.isTreasure = isTreasure;
        this.isKraken = isKraken;
        this.displayName = displayName;
    }
}
