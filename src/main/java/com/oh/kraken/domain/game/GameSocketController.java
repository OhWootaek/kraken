package com.oh.kraken.domain.game;

import com.oh.kraken.domain.game.dto.*;
import com.oh.kraken.domain.room.GameRoomService;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class GameSocketController {

    private final GameService gameService;
    private final GameRoomService gameRoomService;
    private final UserRepository userRepository;

    /**
     * 유저가 방에 처음 구독할 때, 현재 방 상태를 1회 전송
     * Topic: /topic/room/{roomCode}/state
     */
    @SubscribeMapping("/room/{roomCode}/state")
    public RoomStateResponse handleSubscription(
            @DestinationVariable String roomCode,
            @AuthenticationPrincipal OAuth2User oAuth2User) {
        User user = findUserByPrincipal(oAuth2User);
        return gameService.getRoomState(roomCode, user.getEmail());
    }

    /**
     * 유저가 "준비" 버튼을 눌렀을 때
     * Destination: /app/room/{roomCode}/ready
     */
    @MessageMapping("/room/{roomCode}/ready")
    public void handleReady(
            @DestinationVariable String roomCode,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User user = findUserByPrincipal(oAuth2User);
        gameService.toggleReady(user, roomCode);
    }

    /**
     * 유저가 채팅 메시지를 보냈을 때
     * Destination: /app/room/{roomCode}/chat
     */
    @MessageMapping("/room/{roomCode}/chat")
    public void handleChat(
            @DestinationVariable String roomCode,
            @Payload ChatMessage message,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User user = findUserByPrincipal(oAuth2User);
        message.setSenderUsername(user.getUsername());
        gameService.handleChatMessage(message, roomCode);
    }

    // 방장 - 강퇴
    @MessageMapping("/room/{roomCode}/kick")
    public void handleKickPlayer(
            @DestinationVariable String roomCode,
            @Payload KickPlayerRequest request,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User host = findUserByPrincipal(oAuth2User);
        gameRoomService.kickPlayer(roomCode, request.getUsername(), host);
    }

    // 방장 - 최대 인원 변경
    @MessageMapping("/room/{roomCode}/config/max-players")
    public void handleChangeMaxPlayers(
            @DestinationVariable String roomCode,
            @Payload ChangeMaxPlayersRequest request,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User host = findUserByPrincipal(oAuth2User);
        gameRoomService.changeMaxPlayers(roomCode, request.getMaxPlayers(), host);
    }

    // 방장 - 게임 시작
    @MessageMapping("/room/{roomCode}/start")
    public void handleStartGame(
            @DestinationVariable String roomCode,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User host = findUserByPrincipal(oAuth2User);
        gameService.startGame(roomCode, host);
    }

    /**
     * 카드 선택
     */
    @MessageMapping("/room/{roomCode}/select-card")
    public void handleSelectCard(
            @DestinationVariable String roomCode,
            @Payload SelectCardRequest request,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User user = findUserByPrincipal(oAuth2User);
        gameService.selectCard(roomCode, user, request);
    }

    /**
     * 재접속 유저가 인게임 정보 요청
     */
    @MessageMapping("/room/{roomCode}/request-game-state")
    public void handleGameStateRequest(
            @DestinationVariable String roomCode,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        User user = findUserByPrincipal(oAuth2User);
        gameService.broadcastInGameStateToUser(roomCode, user);
    }

    /**
     * 방장 권한 에러 처리기
     * (게임 시작 실패, 강퇴 실패 등)
     * 에러 발생 시, 요청한 방장에게만 1:1로 에러 메시지를 전송
     */
    @MessageExceptionHandler
    @SendToUser("/topic/room/errors") // 1:1 에러 구독 주소
    public GameErrorMessage handleHostException(Exception ex) {
        // (콘솔에도 에러 로그 출력)
        System.err.println("[WebSocket Error]: " + ex.getMessage());
        return new GameErrorMessage(ex.getMessage());
    }

    // Principal(OAuth2User)로부터 User 엔티티를 조회하는 헬퍼 메서드
    private User findUserByPrincipal(OAuth2User oAuth2User) {
        String email = oAuth2User.getAttribute("email");
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid user principal"));
    }
}