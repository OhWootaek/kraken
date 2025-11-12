package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.CardType;
import com.oh.kraken.domain.game.model.GameState;
import com.oh.kraken.domain.game.model.PlayerState;
import com.oh.kraken.domain.room.GameRoom;
import lombok.Getter;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 4-2. 인게임 공용 상태 DTO (1:N 브로드캐스팅용)
 */
@Getter
public class InGameRoomStateDto {
    private String roomCode;
    private String status; // "PLAYING"
    private int currentRound;
    private Long currentTurnPlayerId;
    private int treasuresFound;
    private int treasuresTotal;
    private List<CardType> revealedCardsPile; // 중앙에 공개된 카드 목록
    private List<InGamePlayerDto> players;
    private boolean awaitingNextRound;

    /**
     * @param room DB GameRoom
     * @param game Memory GameState
     * @param playerStates 모든 플레이어 상태
     * @param requestingUserId 이 DTO를 요청한 유저의 ID
     */
    public InGameRoomStateDto(GameRoom room, GameState game, List<PlayerState> playerStates, Long requestingUserId) {
        this.roomCode = game.getRoomCode();
        this.status = room.getStatus().name();
        this.currentRound = game.getCurrentRound();
        this.currentTurnPlayerId = game.getCurrentTurnPlayerId();
        this.treasuresFound = game.getTreasuresFound();
        this.treasuresTotal = game.getTreasuresTotal();
        this.revealedCardsPile = game.getRevealedCards();
        this.awaitingNextRound = game.isAwaitingNextRound();

        // InGamePlayerDto 생성자에 requestingUserId 전달
        this.players = playerStates.stream()
                .map(player -> new InGamePlayerDto(player, requestingUserId))
                .collect(Collectors.toList());
    }
}