package com.oh.kraken.global.websocket;

import com.oh.kraken.domain.game.dto.ChatMessage;
import com.oh.kraken.domain.game.dto.GameResultDto;
import com.oh.kraken.domain.game.dto.RoomStateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GameNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 1:N (전체 방송) 메서드 추가
     * 특정 방의 공용 토픽(/topic/...)에 메시지를 브로드캐스팅합니다.
     */
    public void broadcast(String roomCode, String destination, Object payload) {
        messagingTemplate.convertAndSend(destination, payload);
    }

    // 2. 채팅 메시지 갱신
    public void broadcastChatMessage(String roomCode, ChatMessage message) {
        String destination = "/topic/room/" + roomCode + "/chat";
        messagingTemplate.convertAndSend(destination, message);
    }

    // 특정 유저에게 1:1로 메시지 전송 (amIHost, 에러 메시지 등)
    /**
     * @param username    메시지를 받을 유저의 닉네임 (Spring Security Principal 이름)
     * @param destination 1:1 구독 주소 (예: "/topic/room/errors")
     * @param payload     전송할 객체 (DTO)
     */
    public void notifyUser(String username, String destination, Object payload) {
        messagingTemplate.convertAndSendToUser(username, destination, payload);
    }

    /**
     * 강퇴당한 유저에게 1:1로 알림 전송
     */
    public void sendKickNotification(String userEmail, String message) {
        messagingTemplate.convertAndSendToUser(userEmail, "/topic/room/action", message);
    }

    /**
     * 게임 결과 1:N 방송
     */
    public void broadcastGameResult(String roomCode, GameResultDto result) {
        String destination = "/topic/room/" + roomCode + "/game-result";
        messagingTemplate.convertAndSend(destination, result);
        //broadcast(roomCode, "/game-result", result);
    }
}