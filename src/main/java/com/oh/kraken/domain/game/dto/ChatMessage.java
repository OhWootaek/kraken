package com.oh.kraken.domain.game.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatMessage {
    private String senderUsername;
    private String message;
}
