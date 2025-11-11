package com.oh.kraken.domain.game.model;

import com.oh.kraken.domain.room.GameStatus;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Getter
public class GameState {
    private final String roomCode;
    private final Map<Long, PlayerState> players = new ConcurrentHashMap<>();
    private final List<CardType> revealedCards = new ArrayList<>();

    @Setter
    private int currentRound;
    @Setter
    private Long currentTurnPlayerId;
    @Setter
    private int treasuresFound;
    @Setter
    private int treasuresTotal;

    @Setter // ⭐️ [추가] 4-2: 라운드별 카드 카운터
    private int roundRevealedCount;

    @Setter // ⭐️ [추가] 5-5: 라운드 종료 딜레이 플래그
    private boolean awaitingNextRound = false;

    public GameState(String roomCode) {
        this.roomCode = roomCode;
        this.currentRound = 1;
        this.treasuresFound = 0;
        this.roundRevealedCount = 0; // ⭐️ [추가]
    }

    // ⭐️ [추가] 4-2: 모든 플레이어의 PlayerState 목록 반환
    public List<PlayerState> getAllPlayerStates() {
        return new ArrayList<>(players.values());
    }
}