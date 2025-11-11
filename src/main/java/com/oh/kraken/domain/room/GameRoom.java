package com.oh.kraken.domain.room;

import com.oh.kraken.domain.user.User;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "game_rooms")
@EntityListeners(AuditingEntityListener.class) // CreatedDate 자동 생성을 위해 추가
public class GameRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id")
    private Long id;

    @Column(nullable = false, length = 50)
    private String title;

    @Column(nullable = false, unique = true, length = 4)
    private String roomCode;

    @Column(length = 100)
    private String password; // NULL이면 공개방

    @Column(nullable = false)
    private int maxPlayers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_user_id", nullable = false)
    private User host; // 방장

    // ⭐️ [유지] 1:N 연관관계. GameRoom이 Participant의 생명주기를 관리!
    @OneToMany(mappedBy = "gameRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomParticipant> participants = new ArrayList<>();

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public GameRoom(String title, String roomCode, String password, int maxPlayers, User host) {
        this.title = title;
        this.roomCode = roomCode;
        this.password = password;
        this.maxPlayers = maxPlayers;
        this.host = host;
        this.status = GameStatus.WAITING; // 생성 시 기본 상태는 '대기중'
    }

    //== 편의 메서드 ==//
    public boolean isPublic() {
        return this.password == null || this.password.isEmpty();
    }

    // ⭐️ [유지] 연관관계 헬퍼 메서드
    public void addParticipant(RoomParticipant participant) {
        this.participants.add(participant);
        participant.setGameRoom(this);
    }

    // ⭐️ [유지] 연관관계 헬퍼 메서드
    public void removeParticipant(RoomParticipant participant) {
        this.participants.remove(participant);
        participant.setGameRoom(null);
    }

    // ⭐️ [추가] 3-2: 방장이 최대 인원 변경
    public void changeMaxPlayers(int newMaxPlayers) {
        if (newMaxPlayers < 4 || newMaxPlayers > 6) {
            throw new IllegalArgumentException("최대 인원은 4명에서 6명 사이여야 합니다.");
        }
        if (newMaxPlayers < this.participants.size()) {
            throw new IllegalStateException("현재 인원보다 적게 설정할 수 없습니다.");
        }
        this.maxPlayers = newMaxPlayers;
    }

    // ⭐️ [추가] 3-2: 게임 시작 (상태 변경)
    public void startGame() {
        if (this.status != GameStatus.WAITING) {
            throw new IllegalStateException("대기 중인 방만 시작할 수 있습니다.");
        }
        this.status = GameStatus.PLAYING;
        // 로비 갱신을 위해 status 변경
    }

    /**
     * ⭐️ [신규] 4-2: 게임 종료 (상태 변경)
     */
    public void finishGame() {
        if (this.status != GameStatus.PLAYING) {
            // 게임이 이미 끝났는데 또 호출될 수 있으므로, 예외 대신 경고/무시 처리도 가능
            throw new IllegalStateException("진행 중인 게임만 종료할 수 있습니다.");
        }
        this.status = GameStatus.FINISHED;
    }
}