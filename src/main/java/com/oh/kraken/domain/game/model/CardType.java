package com.oh.kraken.domain.game.model;

import lombok.Getter;

@Getter // ⭐️ [추가]
public enum CardType {
    KRAKEN(false, true, "크라켄"), // ⭐️ [추가] isKraken = true
    TREASURE(true, false, "보물"), // ⭐️ [추가] isTreasure = true
    EMPTY_BOX(false, false, "빈 상자");

    // ⭐️ [신규] 4-3: 카드 타입 메타 정보
    private final boolean isTreasure;
    private final boolean isKraken;
    private final String displayName;

    CardType(boolean isTreasure, boolean isKraken, String displayName) {
        this.isTreasure = isTreasure;
        this.isKraken = isKraken;
        this.displayName = displayName;
    }
}
