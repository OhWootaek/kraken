package com.oh.kraken.domain.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    // 현재 방 인원 수 계산
    int countByGameRoom_Id(Long roomId);

    // 유저 ID로 참여 정보 조회 (재접속 및 중복 입장 방지)
    Optional<RoomParticipant> findByUserId(Long userId);

    // (Optional: findByUserId가 있으므로 exists는 생략 가능하지만, 이게 더 명시적)
    boolean existsByUserId(Long userId);

    // ⭐️ N+1 방지: 방 ID로 모든 참여자를 User와 함께 Fetch Join
    @Query("SELECT p FROM RoomParticipant p JOIN FETCH p.user WHERE p.gameRoom.id = :roomId")
    List<RoomParticipant> findAllByGameRoom_Id(Long roomId);

    // ⭐️ [추가] 3-2: 강퇴 시 닉네임으로 참여자 조회
    Optional<RoomParticipant> findByGameRoom_IdAndUser_Username(Long roomId, String username);
}
