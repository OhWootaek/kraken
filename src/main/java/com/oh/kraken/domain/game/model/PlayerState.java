package com.oh.kraken.domain.game.model;

import com.oh.kraken.domain.user.User;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Getter
public class PlayerState {
    private final Long playerUserId;
    private final String playerUserEmail;
    private final User user;
    private final PlayerRole role;
    private List<CardType> hand; // 1R: 5장, 2R: 4장... (최초 확인용)
    private List<PlayerCard> placedCards; // 섞여서 깔린 카드 (실제 게임용)

    public PlayerState(User user, PlayerRole role, List<CardType> hand) {
        this.playerUserId = user.getId();
        this.playerUserEmail = user.getEmail();
        this.user = user;
        this.role = role;
        this.hand = hand;

        initializeHandAndCards(hand);
    }

    // 손패와 깔린 카드를 초기화하는 헬퍼
    private void initializeHandAndCards(List<CardType> hand) {
        this.hand = hand;
        // "본인도 모르게 섞기" (CardType -> PlayerCard 객체로 변환)
        this.placedCards = hand.stream()
                .map(PlayerCard::new)
                .collect(Collectors.toList());
        Collections.shuffle(this.placedCards);
    }

    /**
     * 4-2: 카드를 "제거"하는 대신 "뒤집고" 타입을 반환
     */
    public CardType revealCard(String cardId) {
        PlayerCard card = this.placedCards.stream()
                .filter(c -> c.getCardId().equals(cardId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 카드 ID입니다: " + cardId));

        if (card.isRevealed()) {
            throw new IllegalStateException("이미 공개된 카드입니다.");
        }

        card.reveal(); // 상태 변경 (isRevealed = true)
        return card.getType();
    }

    /**
     * 4-2: 다음 라운드를 위해 남은 카드(isRevealed = false) 수집
     */
    public List<CardType> getRemainingCardTypes() {
        return placedCards.stream()
                .filter(card -> !card.isRevealed()) // 뒤집히지 않은 카드만
                .map(PlayerCard::getType)
                .collect(Collectors.toList());
    }

    /**
     * [FIX] 4-2: 새 라운드 시작
     */
    public void startNewRound(List<CardType> newHand) {
        initializeHandAndCards(newHand); // 새 손패, 새 배치
    }

    /**
     * 5-5: 다음 라운드를 위해 모든 카드 수집
     */
    public List<CardType> collectAllCards() {
        return placedCards.stream()
                .map(PlayerCard::getType)
                .collect(Collectors.toList());
    }
}