package com.oh.kraken.domain.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface GameRoomRepository extends JpaRepository<GameRoom, Long> {

    // 대기중인 방과 방장 정보를 한 번에 조회
    @Query("SELECT r FROM GameRoom r LEFT JOIN FETCH r.host WHERE r.status = 'WAITING'")
    List<GameRoom> findAllWaitingWithHost();

    // 4자리 코드가 이미 DB에 존재하는지 확인
    boolean existsByRoomCode(String roomCode);

    // 방 코드 검색용
    Optional<GameRoom> findByRoomCode(String roomCode);
}
