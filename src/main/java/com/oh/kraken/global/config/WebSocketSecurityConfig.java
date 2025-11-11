package com.oh.kraken.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.security.config.annotation.web.messaging.MessageSecurityMetadataSourceRegistry;
import org.springframework.security.config.annotation.web.socket.AbstractSecurityWebSocketMessageBrokerConfigurer;

@Configuration
public class WebSocketSecurityConfig extends AbstractSecurityWebSocketMessageBrokerConfigurer {

    /**
     * WebSocket 연결에 대한 보안 규칙을 설정합니다.
     */
    @Override
    protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
        messages
                // (1) STOMP 메시지 타입별 권한 설정
                .simpTypeMatchers(SimpMessageType.CONNECT).authenticated()
                .simpTypeMatchers(SimpMessageType.DISCONNECT).authenticated()
                .simpTypeMatchers(SimpMessageType.UNSUBSCRIBE).authenticated()
                .simpTypeMatchers(SimpMessageType.MESSAGE).authenticated() // /app/** (발행)
                .simpTypeMatchers(SimpMessageType.SUBSCRIBE).authenticated() // /topic/** (구독)

                // (2) ⭐️ [핵심] 구독(SUBSCRIBE) 경로별 세부 설정
                // /app/** 경로는 1회성 데이터 요청이므로 구독 허용
                .simpSubscribeDestMatchers("/app/**").authenticated()
                // /user/** 경로는 1:1 메시지이므로 구독 허용
                .simpSubscribeDestMatchers("/user/**").authenticated()
                // /topic/** 경로는 공용 방송이므로 구독 허용
                .simpSubscribeDestMatchers("/topic/**").authenticated()

                // (3) ⭐️ [핵심] 메시지 발행(MESSAGE) 경로별 세부 설정
                .simpDestMatchers("/app/**").authenticated()

                // (4) 그 외 모든 메시지는 일단 거부
                .anyMessage().denyAll();
    }

    /**
     * ⭐️ [핵심]
     * CSRF 토큰 검사를 비활성화합니다.
     * (활성화하려면 클라이언트 STOMP 헤더에 CSRF 토큰을 추가해야 하므로 복잡해짐)
     */
    @Override
    protected boolean sameOriginDisabled() {
        return true;
    }
}