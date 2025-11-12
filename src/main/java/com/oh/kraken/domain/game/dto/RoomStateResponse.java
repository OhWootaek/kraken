package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.room.GameRoom;
import com.oh.kraken.domain.room.GameStatus;
import com.oh.kraken.domain.room.RoomParticipant;
import lombok.Getter;

import java.util.List;
import java.util.stream.Collectors;

@Getter
public class RoomStateResponse {
    private String roomCode;
    private int currentPlayers;
    private int maxPlayers;
    private List<ParticipantDto> participants;
    private Long hostId;
    private GameStatus status;

    public RoomStateResponse(GameRoom room, List<RoomParticipant> participants) {
        this.roomCode = room.getRoomCode();
        this.maxPlayers = room.getMaxPlayers();
        this.participants = participants.stream()
                .map(ParticipantDto::new)
                .collect(Collectors.toList());
        this.currentPlayers = this.participants.size();
        this.hostId = room.getHost().getId();
        this.status = room.getStatus();
    }
}