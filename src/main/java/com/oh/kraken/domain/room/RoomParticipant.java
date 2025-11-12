package com.oh.kraken.domain.room;

import com.oh.kraken.domain.user.User;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "room_participants")
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "participant_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private GameRoom gameRoom;

    // ⭐️ user_id UNIQUE 제약조건을 위해 OneToOne 사용
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false)
    private boolean isReady = false;

    @Column(updatable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Builder
    public RoomParticipant(GameRoom gameRoom, User user, boolean isReady) {
        this.gameRoom = gameRoom;
        this.user = user;
        this.isReady = isReady;
    }

    //== 비즈니스 로직 ==//
    public void toggleReady() {
        this.isReady = !this.isReady;
    }

    public void setGameRoom(GameRoom gameRoom) {
        this.gameRoom = gameRoom;
    }

    public void setUser(User user) {
        this.user = user;
    }
}