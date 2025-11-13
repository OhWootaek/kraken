package com.oh.kraken.domain.room;

import com.oh.kraken.domain.game.GameService;
import com.oh.kraken.domain.room.dto.RoomCreateRequest;
import com.oh.kraken.domain.room.dto.RoomLobbyResponse;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.global.websocket.GameNotificationService;
import com.oh.kraken.global.websocket.LobbyNotificationService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GameRoomService {
    private final GameRoomRepository gameRoomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final LobbyNotificationService lobbyNotificationService; // 로비 갱신 알림
    private final PasswordEncoder passwordEncoder; // 비밀번호 암호화
    private final GameService gameService;
    private final GameNotificationService gameNotificationService;
    private final EntityManager em;

    /**
     * 유저가 현재 방에 참여 중인지 확인하고, 있다면 강제 퇴장
     */
    @Transactional
    public void cleanupParticipantIfExists(Long userId) {
        roomParticipantRepository.findByUserId(userId).ifPresent(participant -> {
            GameRoom room = participant.getGameRoom();
            User user = participant.getUser();

            // 연관관계 제거
            room.removeParticipant(participant);
            if (user != null) {
                user.setParticipant(null);
            }

            em.flush();

            // 만약 방장이었다면...
            if (room.getHost().getId().equals(userId)) {
                promoteNextHostOrDeleteRoom(room);
            }

            // 갱신 알림
            lobbyNotificationService.notifyLobbyUpdate();
            gameService.broadcastCurrentState(room.getRoomCode());
        });
    }

    // 1. 로비 목록 조회 
    public List<RoomLobbyResponse> getWaitingRooms() {

        // 대기중인 방과 방장 정보를 한 번에 조회
        List<GameRoom> waitingRooms = gameRoomRepository.findAllWaitingWithHost();

        return waitingRooms.stream()
                .map(room -> {
                    int currentPlayers = roomParticipantRepository.countByGameRoom_Id(room.getId());
                    return new RoomLobbyResponse(room, currentPlayers);
                })
                .collect(Collectors.toList());
    }

    // 2. 방 코드로 검색
    public RoomLobbyResponse findRoomByCode(String roomCode) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방 코드입니다."));

        // (검색 시에는 게임 중인 방도 찾을 수 있게 함)
        return mapToLobbyResponse(room);
    }

    // 3. DTO 변환 (현재 인원 수 계산)
    private RoomLobbyResponse mapToLobbyResponse(GameRoom room) {
        int currentPlayers = roomParticipantRepository.countByGameRoom_Id(room.getId());
        return new RoomLobbyResponse(room, currentPlayers);
    }

    /**
     * 게임방 입장
     */
    @Transactional
    public void joinRoom(String roomCode, String password, User user) {
        cleanupParticipantIfExists(user.getId());

        // 1. 유저가 이미 다른 방에 있는지 확인 (DB Unique 제약 위반 방지)
        if (roomParticipantRepository.existsByUserId(user.getId())) {
            throw new IllegalStateException("이미 다른 방에 참여 중입니다.");
        }

        // 2. 방 조회
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        // 3. 방 상태 검증 (정원, 게임상태)
        if (room.getStatus() != GameStatus.WAITING) {
            throw new IllegalStateException("이미 게임이 시작되었거나 종료된 방입니다.");
        }
        int currentPlayers = roomParticipantRepository.countByGameRoom_Id(room.getId());
        if (currentPlayers >= room.getMaxPlayers()) {
            throw new IllegalStateException("방이 꽉 찼습니다.");
        }

        // 4. 비밀번호 검증 (비공개 방일 경우)
        if (!room.isPublic()) {
            if (password == null || !passwordEncoder.matches(password, room.getPassword())) {
                throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
            }
        }

        // 5. 모든 검증 통과 -> 참여자 등록
        RoomParticipant newParticipant = RoomParticipant.builder()
                .gameRoom(room)
                .user(user)
                .isReady(false)
                .build();

        // 6. Participant를 먼저 DB에 저장 (영속화)
        roomParticipantRepository.saveAndFlush(newParticipant);

        room.addParticipant(newParticipant);
        user.setParticipant(newParticipant);

        // 7. 로비 갱신 알림
        lobbyNotificationService.notifyLobbyUpdate();

        // 8. 방 내부에도  알림 전송
        gameService.broadcastCurrentState(roomCode);
    }

    private void promoteNextHostOrDeleteRoom(GameRoom room) {
        // 방장이 나갔지만 사람 남음 -> 위임
        // 쿼리 메서드 사용 (가장 먼저 들어온 사람)
        RoomParticipant nextHostParticipant = roomParticipantRepository
                .findFirstByGameRoom_IdAndUser_IdNotOrderByJoinedAtAsc(room.getId(), room.getHost().getId())
                .orElse(room.getParticipants().get(0));

        User newHost = nextHostParticipant.getUser();
        room.setHost(newHost); // 2. GameRoom의 host 변경

        // 3. 새 방장은 항상 Ready
        nextHostParticipant.setReady(true);
    }

    /**
     * 게임방 나가기
     */
    @Transactional
    public void leaveRoom(User user) {

        RoomParticipant participant = roomParticipantRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalStateException("참여 중인 방이 없습니다."));

        GameRoom room = participant.getGameRoom();

        // 헬퍼 메서드로 관계 끊기
        room.removeParticipant(participant);
        user.setParticipant(null);

        // 메모리에서 게임 상태 제거
        if (room.getStatus() != GameStatus.PLAYING) {
            gameService.removeGame(room.getRoomCode());
        }

        gameRoomRepository.flush();

        em.flush();

        gameRoomRepository.save(room);

        int remainingPlayers = roomParticipantRepository.countByGameRoom_Id(room.getId());

        if (remainingPlayers == 0) {
            gameRoomRepository.delete(room);
        } else {
            if (room.getHost().getId().equals(user.getId())) {
                promoteNextHostOrDeleteRoom(room);
            }
            gameService.broadcastCurrentState(room.getRoomCode());
        }

        lobbyNotificationService.notifyLobbyUpdate();
    }

    /**
     *  게임방 생성
     */
    @Transactional
    public GameRoom createRoom(RoomCreateRequest request, User host) {
        cleanupParticipantIfExists(host.getId());

        // 1. 4자리 고유 코드 생성
        String roomCode = generateUniqueRoomCode();

        // 2. 비밀번호 암호화 (비밀번호가 있으면 비공개방)
        String encodedPassword = null;
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            encodedPassword = passwordEncoder.encode(request.getPassword());
        }

        // 3. GameRoom 엔티티 생성
        GameRoom gameRoom = GameRoom.builder()
                .title(request.getTitle())
                .roomCode(roomCode)
                .password(encodedPassword) // 암호화된 비밀번호 또는 null
                .maxPlayers(request.getMaxPlayers())
                .host(host)
                .build();

        // 4. 방장을 첫 번째 참여자로 등록
        // (방장은 항상 준비된 상태로 시작)
        RoomParticipant hostParticipant = RoomParticipant.builder()
                .gameRoom(gameRoom)
                .user(host)
                .isReady(true)
                .build();

        gameRoom.addParticipant(hostParticipant);
        host.setParticipant(hostParticipant);

        gameRoomRepository.saveAndFlush(gameRoom);

        // 5. 로비에 "방 목록 갱신" 알림 전송
        lobbyNotificationService.notifyLobbyUpdate();

        return gameRoom;
    }

    /**
     * 4자리 고유 숫자 코드 생성기 (1000 ~ 9999)
     */
    private String generateUniqueRoomCode() {
        Random random = new Random();
        String roomCode;
        do {
            int code = 1000 + random.nextInt(9000); // 1000 ~ 9999
            roomCode = String.valueOf(code);
        } while (gameRoomRepository.existsByRoomCode(roomCode)); // 중복 시 재시도

        return roomCode;
    }

    // 플레이어 강퇴
    @Transactional
    public void kickPlayer(String roomCode, String usernameToKick, User host) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        // 1. 방장인지 확인
        if (!room.getHost().getId().equals(host.getId())) {
            throw new IllegalStateException("방장만 강퇴할 수 있습니다.");
        }

        // 2. 자신을 강퇴하려는지 확인
        if (host.getUsername().equals(usernameToKick)) {
            throw new IllegalArgumentException("자기 자신을 강퇴할 수 없습니다.");
        }

        // 3. 강퇴할 대상 찾기
        RoomParticipant participantToKick = roomParticipantRepository.findByGameRoom_IdAndUser_Username(room.getId(), usernameToKick)
                .orElseThrow(() -> new IllegalArgumentException("방에 해당 유저가 없습니다."));

        // 4. '준비 완료' 상태인 유저는 강퇴 불가 (명세서)
        if (participantToKick.isReady()) {
            throw new IllegalStateException("준비 완료 상태인 유저는 강퇴할 수 없습니다.");
        }

        String kickedUserEmail = participantToKick.getUser().getEmail();
        gameNotificationService.sendKickNotification(kickedUserEmail, "방장에 의해 강퇴당했습니다.");

        // 5. 강퇴 (연관관계 제거)
        room.removeParticipant(participantToKick);
        participantToKick.getUser().setParticipant(null);

        if (room.getStatus() != GameStatus.PLAYING) {
            gameService.removeGame(room.getRoomCode());
        }

        gameRoomRepository.flush();

        em.flush();

        gameRoomRepository.save(room);

        // 6. 알림
        lobbyNotificationService.notifyLobbyUpdate(); // 로비 인원 갱신
        gameService.broadcastCurrentState(roomCode); // 방 내부 인원 갱신

    }

    // 최대 인원 변경
    @Transactional
    public void changeMaxPlayers(String roomCode, int newMaxPlayers, User host) {
        GameRoom room = gameRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        // 1. 방장인지 확인
        if (!room.getHost().getId().equals(host.getId())) {
            throw new IllegalStateException("방장만 설정을 변경할 수 있습니다.");
        }

        // 2. 엔티티 내부에서 로직 처리
        room.changeMaxPlayers(newMaxPlayers);

        gameRoomRepository.saveAndFlush(room);

        // 3. 알림
        lobbyNotificationService.notifyLobbyUpdate(); // 로비 갱신
        gameService.broadcastCurrentState(roomCode); // 방 내부 갱신
    }
}
