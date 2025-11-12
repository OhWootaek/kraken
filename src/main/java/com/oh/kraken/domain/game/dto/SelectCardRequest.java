package com.oh.kraken.domain.game.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SelectCardRequest {
    private Long targetPlayerId;
    private String selectedCardId;
}