package com.oh.kraken.domain.room.dto;

import com.oh.kraken.domain.room.GameRoom;
import com.oh.kraken.domain.room.GameStatus;
import lombok.Getter;

@Getter
public class RoomLobbyResponse {

    private Long roomId;
    private String title;
    private String roomCode;
    private boolean isPublic;
    private int currentPlayers;
    private int maxPlayers;
    private GameStatus status;
    private String hostUsername;

    public RoomLobbyResponse(GameRoom room, int currentPlayers) {
        this.roomId = room.getId();
        this.title = room.getTitle();
        this.roomCode = room.getRoomCode();
        this.isPublic = room.isPublic();
        this.currentPlayers = currentPlayers;
        this.maxPlayers = room.getMaxPlayers();
        this.status = room.getStatus();
        this.hostUsername = room.getHost().getUsername();
    }
}