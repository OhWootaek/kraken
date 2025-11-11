package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.room.RoomParticipant;
import lombok.Getter;

@Getter
public class ParticipantDto {
    private Long userId;
    private String username;
    private boolean isReady;

    public ParticipantDto(RoomParticipant participant) {
        this.userId = participant.getUser().getId();
        this.username = participant.getUser().getUsername();
        this.isReady = participant.isReady();
    }
}
