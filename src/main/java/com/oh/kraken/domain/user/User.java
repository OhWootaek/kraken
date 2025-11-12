package com.oh.kraken.domain.user;

import com.oh.kraken.domain.room.RoomParticipant;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    // 1. 사용자가 직접 설정할 고유 닉네임
    @Column(unique = true)
    private String username;

    // 2. 구글에서 받아올 고유 식별자 (로그인 시 사용)
    @Column(nullable = false, unique = true)
    private String email;

    // 3. 권한 (GUEST, USER)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // 4. 어떤 OAuth 제공자인지 (e.g., GOOGLE)
    private String provider;

    // 5. 참가자 정보 (RoomParticipant) - 1:1 양방향 매핑 - 한명의 유저는 하나의 방에만 참가 가능
    @OneToOne(mappedBy = "user", fetch = FetchType.LAZY)
    private RoomParticipant participant;

    @Builder
    public User(String email, Role role, String provider) {
        this.email = email;
        this.role = role;
        this.provider = provider;
    }

    //== 비즈니스 로직 ==//

    /**
     * GUEST -> USER로 승급하며 username 등록
     */
    public User updateUsernameAndRole(String username) {
        this.username = username;
        this.role = Role.ROLE_USER;
        return this;
    }

    /**
     * username 변경
     */
    public void updateUsername(String newUsername) {
        this.username = newUsername;
    }

    public void setParticipant(RoomParticipant participant) {
        this.participant = participant;
        if (participant != null) {
            participant.setUser(this);
        }
    }
}
