package com.oh.kraken.domain.game;

import com.oh.kraken.domain.game.dto.*;
import com.oh.kraken.domain.game.model.CardType;
import com.oh.kraken.domain.game.model.GameState;
import com.oh.kraken.domain.game.model.PlayerRole;
import com.oh.kraken.domain.game.model.PlayerState;
import com.oh.kraken.domain.room.*;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.global.websocket.GameNotificationService;
import com.oh.kraken.global.websocket.LobbyNotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GameService {
    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    private final GameRoomRepository gameRoomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final GameNotificationService gameNotificationService;
    private final LobbyNotificationService lobbyNotificationService; // 게임 시작 시 로비 갱신용
    private final TaskScheduler taskScheduler; // 지연 작업 스케줄러

    // 현재 진행중인 게임 상태를 서버 메모리에 저장
    private final Map<String, GameState> activeGames = new ConcurrentHashMap<>();

    /**
     * 현재 방의 전체 상태를 가져옵니다. (주로 @SubscribeMapping 용)
     */
    @Transactional(readOnly = true)
    public RoomStateResponse getRoomState(String roomCode, String userEmail) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        List<RoomParticipant> participants = roomParticipantRepository.findAllByGameRoom_Id(room.getId());

        return new RoomStateResponse(room, participants);
    }

    /**
     * 유저의 준비 상태를 토글합니다.
     */
    @Transactional
    public void toggleReady(User user, String roomCode) {
        RoomParticipant participant = roomParticipantRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalStateException("참여자가 아닙니다."));

        // 방장(Host)은 '준비' 상태를 변경할 수 없습니다 (항상 Ready)
        if (!participant.getGameRoom().getHost().getId().equals(user.getId())) {
            participant.toggleReady();
            roomParticipantRepository.saveAndFlush(participant);
        }

        // 갱신된 방 상태를 모두에게 브로드캐스팅
        broadcastCurrentState(roomCode);
    }

    /**
     * 채팅 메시지를 브로드캐스팅합니다.
     */
    public void handleChatMessage(ChatMessage message, String roomCode) {
        // (추후 DB 저장 로직 추가 가능)
        gameNotificationService.broadcastChatMessage(roomCode, message);
    }

    /**
     * 현재 방 상태 브로드캐스팅
     * (amIHost 필드 때문에 1:1로 전송)
     */
    @Transactional
    public void broadcastCurrentState(String roomCode) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElse(null); // 방이 삭제된 직후라면 null일 수 있음

        if (room == null) return;

        List<RoomParticipant> participants = roomParticipantRepository.findAllByGameRoom_Id(room.getId());

        RoomStateResponse stateForAll = new RoomStateResponse(room, participants);

        // 1:N (전체 방송) 호출
        gameNotificationService.broadcast(roomCode, "/topic/room/" + roomCode + "/state", stateForAll);
    }

    /**
     * [3-2] 게임 시작
     */
    @Transactional
    public void startGame(String roomCode, User host) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        // 1. 방장인지 확인
        if (!room.getHost().getId().equals(host.getId())) {
            throw new IllegalStateException("방장만 게임을 시작할 수 있습니다.");
        }

        // 2. 최소 인원 확인
        List<RoomParticipant> participants = room.getParticipants();
        int playerCount = participants.size();

        // 3. 인원 수 일치 확인 (버그 수정)
        if (playerCount != room.getMaxPlayers()) {
            throw new IllegalStateException("인원이 꽉 차지 않았습니다. (현재 " + playerCount + "/" + room.getMaxPlayers() + "명)");
        }

        if (playerCount < 4) {
            throw new IllegalStateException("최소 4명 이상이어야 게임을 시작할 수 있습니다.");
        }

        // 4. 방장 외 모두 준비 완료했는지 확인
        boolean allReady = participants.stream()
                .filter(p -> !p.getUser().getId().equals(host.getId())) // 방장 제외
                .allMatch(RoomParticipant::isReady); // 모두 준비했는지?

        if (!allReady) {
            throw new IllegalStateException("아직 준비되지 않은 유저가 있습니다.");
        }

        // 5. 게임 상태 객체 생성
        GameState newGame = new GameState(roomCode);
        newGame.setTreasuresTotal(playerCount); // 보물 = 인원수

        // 6. 역할 배정
        List<PlayerRole> rolesToAssign = new ArrayList<>();
        if (playerCount == 4) {
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.SKELETON);
            rolesToAssign.add(PlayerRole.SKELETON);
        } else { // 5~6인
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.EXPLORER);
            rolesToAssign.add(PlayerRole.SKELETON);
            rolesToAssign.add(PlayerRole.SKELETON);
        }
        Collections.shuffle(rolesToAssign);

        // 7. 게임 덱 생성
        List<CardType> deck = new ArrayList<>();
        deck.add(CardType.KRAKEN);
        for (int i = 0; i < playerCount; i++) {
            deck.add(CardType.TREASURE);
        }
        int emptyCards = (playerCount * 5) - deck.size();
        for (int i = 0; i < emptyCards; i++) {
            deck.add(CardType.EMPTY_BOX);
        }
        Collections.shuffle(deck);

        // 8. 카드 분배 및 PlayerState 생성
        Random random = new Random();
        for (int i = 0; i < participants.size(); i++) {
            RoomParticipant participant = participants.get(i);
            User user = participant.getUser();

            PlayerRole assignedRole = rolesToAssign.get(i);

            // 덱에서 5장 뽑기
            List<CardType> hand = new ArrayList<>(deck.subList(i * 5, (i + 1) * 5));

            // 본인도 모르게 섞기 (손패 복사 후 셔플)
            List<CardType> placedCards = new ArrayList<>(hand);
            Collections.shuffle(placedCards);

            // PlayerState 생성 (손패만 전달하면, 내부에서 섞어서 placedCards 생성)
            PlayerState playerState = new PlayerState(user, assignedRole, hand);

            // GameState에 플레이어 정보 저장
            newGame.getPlayers().put(user.getId(), playerState);
        }

        // 9. 게임 시작 상태 설정
        newGame.setCurrentTurnPlayerId(participants.get(random.nextInt(playerCount)).getUser().getId());

        // 10. 서버 메모리에 게임 상태 저장
        activeGames.put(roomCode, newGame);

        log.info("==================================================");
        log.info("[Game Setup] New Game Created for Room: {}", roomCode);
        log.info("[Game Setup] Total Players: {}", playerCount);
        log.info("[Game Setup] Deck Size: {} cards (K:1, T:{}, E:{}", deck.size(), newGame.getTreasuresTotal(), emptyCards);

        for (PlayerState player : newGame.getPlayers().values()) {
            log.info("[Game Setup] > Player: {} | Role: {} | Hand: {} cards | Placed: {} cards",
                    player.getUser().getUsername(),
                    player.getRole(),
                    player.getHand().size(),
                    player.getPlacedCards().size()
            );
            // (첫 번째 플레이어의 실제 손패 5장을 로그로 확인)
            if (player.getUser().getId().equals(host.getId())) {
                log.info("[Game Setup] > Host Hand (Sample): {}", player.getHand().stream().map(CardType::name).collect(Collectors.toList()));
            }
        }
        log.info("==================================================");

        // 11. 게임 시작 (상태 변경)
        room.startGame(); // 상태를 PLAYING으로 변경
        gameRoomRepository.saveAndFlush(room);

        // 12. 로비에 알림 (방 목록에서 "게임중"으로 보이도록)
        lobbyNotificationService.notifyLobbyUpdate();

        // 13. 방 내부에 "게임 시작" 알림 (1:1 DTO 전송)
        broadcastInGameState(roomCode);
    }

    /**
     * 4-2: 카드 선택 (턴 진행)
     */
    @Transactional
    public void selectCard(String roomCode, User user, SelectCardRequest request) {
        GameState game = activeGames.get(roomCode);

        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        if (game == null || room.getStatus() != GameStatus.PLAYING) {
            throw new IllegalStateException("게임이 진행 중이 아닙니다.");
        }

        // 라운드 딜레이 중에는 카드 선택 불가
        if (game.isAwaitingNextRound()) {
            throw new IllegalStateException("다음 라운드를 준비 중입니다.");
        }

        // 1. 턴 확인
        if (!game.getCurrentTurnPlayerId().equals(user.getId())) {
            throw new IllegalStateException("당신의 턴이 아닙니다.");
        }

        // 2. 자신 카드 선택 금지
        if (request.getTargetPlayerId().equals(user.getId())) {
            throw new IllegalStateException("자신의 카드는 선택할 수 없습니다.");
        }

        // 3. 카드 공개
        PlayerState targetPlayer = game.getPlayers().get(request.getTargetPlayerId());
        if (targetPlayer == null) {
            throw new IllegalArgumentException("유효하지 않은 플레이어입니다.");
        }
        String selectedCardId = request.getSelectedCardId();
        CardType revealedCard = targetPlayer.revealCard(selectedCardId);

        log.info("[Game Turn] Player {} revealed {}'s card: {}",
                user.getUsername(), targetPlayer.getUser().getUsername(), revealedCard);

        game.getRevealedCards().add(revealedCard);
        game.setRoundRevealedCount(game.getRoundRevealedCount() + 1);

        // 크라켄 카드 공개 시 (스켈레톤 승리 1)
        if (revealedCard == CardType.KRAKEN) {
            broadcastInGameState(roomCode);
            handleGameEnd(game, PlayerRole.SKELETON); // 스켈레톤 승리
            return; // 게임 종료 후 추가 로직 불필요
        }

        // 보물 카드 공개 시 (보물 카운트 증가)
        if (revealedCard == CardType.TREASURE) {
            game.setTreasuresFound(game.getTreasuresFound() + 1);
            log.info("[Game {}] Treasure found! Total: {}/{}", roomCode, game.getTreasuresFound(), game.getTreasuresTotal());

            // 모든 보물 카드 찾았는지 확인 (탐험대 승리)
            if (game.getTreasuresFound() >= game.getTreasuresTotal()) {
                broadcastInGameState(roomCode); // 마지막 보물 카드 보여주기
                handleGameEnd(game, PlayerRole.EXPLORER); // 탐험대 승리
                return; // 게임 종료 후 추가 로직 불필요
            }
        }

        // 4. 다음 턴 설정
        Long nextPlayerId = request.getTargetPlayerId(); // 카드 주인이 다음 턴

        // 5. 라운드 종료 조건 확인
        // 카드가 플레이 인원수만큼 공개되면 라운드 종료
        if (game.getRoundRevealedCount() >= game.getPlayers().size()) {
            game.setAwaitingNextRound(true);
            broadcastInGameState(roomCode);

            // 3초 후 다음 라운드 진행
            taskScheduler.schedule(() -> {
                handleNextRound(game, nextPlayerId);
            }, Instant.now().plusSeconds(3));

            // 라운드 종료 후 승리 조건 확인 (스켈레톤 승리 2)
            if (game.getCurrentRound() > 4) { // 4라운드까지 진행 완료
                handleGameEnd(game, PlayerRole.SKELETON); // 보물 다 못 찾으면 스켈레톤 승리
                return;
            }
        } else {
            // 6. 다음 턴 플레이어 설정 (공개된 카드의 주인이 다음 턴)
            game.setCurrentTurnPlayerId(nextPlayerId);
            broadcastInGameState(roomCode);
        }

        // 7. 변경된 게임 상태 브로드캐스팅
        broadcastInGameState(roomCode);
    }

    /**
     * 4-2: 다음 라운드 준비
     */
    @Transactional
    private void handleNextRound(GameState game, Long lastCardOwnerId) {
        log.info("[Game {}] Round {} ended. Preparing for next round.", game.getRoomCode(), game.getCurrentRound());

        game.setAwaitingNextRound(false);

        game.setCurrentRound(game.getCurrentRound() + 1);
        game.setRoundRevealedCount(0);
        game.getRevealedCards().clear();

        log.info("[Game Round] Starting Round {}", game.getCurrentRound());

        // 4라운드 초과 시 게임 종료 (스켈레톤 승리 2)
        if (game.getCurrentRound() > 4) {
            log.info("[Game {}] All 4 rounds completed. Treasures found: {}/{}. Game ending.",
                    game.getRoomCode(), game.getTreasuresFound(), game.getTreasuresTotal());
            handleGameEnd(game, PlayerRole.SKELETON); // 스켈레톤 승리
            return;
        }

        // 1. 남은 카드 수집
        List<CardType> remainingDeck = new ArrayList<>();
        for (PlayerState player : game.getAllPlayerStates()) {
            remainingDeck.addAll(player.getRemainingCardTypes());
        }
        Collections.shuffle(remainingDeck);

        // 2. 재분배
        int cardsToDeal = 5 - (game.getCurrentRound() - 1); // R2=4, R3=3, R4=2
        int deckIndex = 0;
        for (PlayerState player : game.getAllPlayerStates()) {
            List<CardType> newHand = new ArrayList<>(
                    remainingDeck.subList(deckIndex, deckIndex + cardsToDeal)
            );
            player.startNewRound(newHand); // 새 손패, 새 배치
            deckIndex += cardsToDeal;
        }

        // 3. 다음 턴 설정
        game.setCurrentTurnPlayerId(lastCardOwnerId);
        broadcastInGameState(game.getRoomCode());
    }

    /**
     * 4-2: 게임 종료 처리
     */
    @Transactional
    public void handleGameEnd(GameState game, PlayerRole winner) {
        log.info("[Game End] Game Over! Winner: {}", winner);

        GameRoom room = gameRoomRepository.findByRoomCode(game.getRoomCode())
                .orElseThrow(() -> new IllegalArgumentException("게임 종료 중 방을 찾을 수 없습니다."));
        room.finishGame();
        room.getParticipants().clear();
        gameRoomRepository.saveAndFlush(room);

        GameResultDto resultDto = new GameResultDto(game, winner);

        gameNotificationService.broadcastGameResult(game.getRoomCode(), resultDto);

        // 게임 상태 메모리에서 제거
        removeGame(game.getRoomCode());

        // 로비 갱신
        lobbyNotificationService.notifyLobbyUpdate();
    }

    /**
     * 인게임 상태 1:1 브로드캐스팅
     */
    public void broadcastInGameState(String roomCode) {
        GameState game = activeGames.get(roomCode);
        if (game == null) return;

        GameRoom room = gameRoomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return;

        List<PlayerState> allPlayerStates = game.getAllPlayerStates();

        // 각 플레이어에게 "공통정보 + 나의 비밀정보" DTO를 1:1 전송
        for (PlayerState player : allPlayerStates) {
            Long requestingUserId = player.getPlayerUserId();
            String userEmail = player.getUser().getEmail();

            InGameRoomStateDto commonStateDto = new InGameRoomStateDto(room, game, allPlayerStates, requestingUserId);

            MyGamePlayerDto myPrivateStateDto = new MyGamePlayerDto(player, requestingUserId);


            // 1:1 메시지 페이로드
            Map<String, Object> payload = Map.of(
                    "commonState", commonStateDto,
                    "myState", myPrivateStateDto
            );

            gameNotificationService.notifyUser(
                    userEmail,
                    "/topic/room/" + roomCode + "/game-state",
                    payload
            );
        }
    }

    // [신규] 방 나가기/종료 시 메모리에서 게임 상태 제거
    @Transactional
    public void removeGame(String roomCode) {
        activeGames.remove(roomCode);
    }
}