package com.oh.kraken.domain.game.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 방장 전용 에러 메시지를 WebSocket을 통해 1:1로 보낼 때 사용
 * (예: "아직 준비되지 않은 유저가 있습니다")
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GameErrorMessage {
    // 에러 메시지 내용
    private String error;
}