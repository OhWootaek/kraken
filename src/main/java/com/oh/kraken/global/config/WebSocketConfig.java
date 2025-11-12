package com.oh.kraken.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 1. 클라이언트가 구독(Subscribe)할 경로 prefix 설정
        // (예: /topic/lobby/update)
        registry.enableSimpleBroker("/topic");

        // 2. 클라이언트가 서버에 메시지를 보낼 때(Publish) 사용할 경로 prefix 설정
        // (예: /app/chat/message) - (지금 당장 사용하진 않음)
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 3. 클라이언트가 WebSocket에 최초 접속할 때 사용할 엔드포인트
        // (lobby.js의 new SockJS('/ws-stomp')와 일치해야 함)
        registry.addEndpoint("/ws-stomp").withSockJS();
    }
}