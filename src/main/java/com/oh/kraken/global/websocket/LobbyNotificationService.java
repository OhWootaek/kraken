package com.oh.kraken.global.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LobbyNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    // 로비에 있는 모든 사람에게 "방 목록 갱신하라"고 알림
    public void notifyLobbyUpdate() {
        // 클라이언트는 이 "알림"을 받으면 /api/rooms를 다시 호출함
        messagingTemplate.convertAndSend("/topic/lobby/update", "refresh");
    }
}