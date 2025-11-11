package com.oh.kraken.domain.game.dto;

import com.oh.kraken.domain.game.model.CardType;
import com.oh.kraken.domain.game.model.GameState;
import com.oh.kraken.domain.game.model.PlayerRole;

import lombok.Getter;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 5-3. 게임 결과 DTO
 */
@Getter
public class GameResultDto {
    private final PlayerRole winnerRole;
    private final int treasuresFound;
    private final int treasuresTotal;
    private final boolean krakenFound;
    private final List<PlayerResultDto> players;

    public GameResultDto(GameState game, PlayerRole winnerRole) {
        this.winnerRole = winnerRole;
        this.treasuresFound = game.getTreasuresFound();
        this.treasuresTotal = game.getTreasuresTotal();
        this.krakenFound = game.getRevealedCards().contains(CardType.KRAKEN);
        this.players = game.getAllPlayerStates().stream()
                .map(PlayerResultDto::new)
                .collect(Collectors.toList());
    }
}