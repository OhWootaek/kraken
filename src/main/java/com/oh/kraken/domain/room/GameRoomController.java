package com.oh.kraken.domain.room;

import com.oh.kraken.domain.room.dto.RoomCreateRequest;
import com.oh.kraken.domain.room.dto.RoomLobbyResponse; // ⭐️ 추가
import com.oh.kraken.domain.user.User;
import com.oh.kraken.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity; // ⭐️ 추가
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller; // ⭐️ @RestController -> @Controller
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*; // ⭐️ 추가
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List; // ⭐️ 추가

@Controller // ⭐️ 1. @RestController에서 변경
// @RequestMapping("/api/rooms") // ⭐️ 2. 클래스 레벨 RequestMapping 삭제
@RequiredArgsConstructor
public class GameRoomController {

    private final GameRoomService gameRoomService; // ⭐️ gameRoomService 주입
    private final UserRepository userRepository;

    /**
     * ⭐️ 3. 로비 API (경로 수정 및 @ResponseBody 추가)
     */
    @GetMapping("/api/rooms")
    @ResponseBody // ⭐️ JSON을 반환하도록 추가
    public ResponseEntity<List<RoomLobbyResponse>> getLobbyList() {
        return ResponseEntity.ok(gameRoomService.getWaitingRooms());
    }

    /**
     * ⭐️ 4. 방 검색 API (경로 수정 및 @ResponseBody 추가)
     */
    @GetMapping("/api/rooms/search")
    @ResponseBody // ⭐️ JSON을 반환하도록 추가
    public ResponseEntity<RoomLobbyResponse> getRoomByCode(@RequestParam String code) {
        RoomLobbyResponse room = gameRoomService.findRoomByCode(code);
        return ResponseEntity.ok(room);
    }


    /**
     * ⭐️ 5. 방 생성 처리 (경로 수정 없음, /room/create 그대로 사용)
     */
    @PostMapping("/room/create")
    public String createRoom(
            RoomCreateRequest request, // 폼 데이터
            @AuthenticationPrincipal OAuth2User oAuth2User,
            RedirectAttributes redirectAttributes) {

        // 1. 현재 로그인한 유저(방장) 정보 조회
        String email = oAuth2User.getAttribute("email");
        User host = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid user email"));

        try {
            // 2. 방 생성 서비스 호출
            GameRoom newRoom = gameRoomService.createRoom(request, host);

            // 3. 생성 성공 시 해당 방으로 즉시 리다이렉트
            return "redirect:/room/" + newRoom.getRoomCode(); // ⭐️ /room/1234

        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "방 생성에 실패했습니다: " + e.getMessage());
            return "redirect:/lobby";
        }
    }

    /**
     * ⭐️ 신규: 게임방 입장 처리
     */
    @PostMapping("/room/join")
    public String joinRoom(
            @RequestParam String roomCode,
            @RequestParam(required = false) String password,
            @AuthenticationPrincipal OAuth2User oAuth2User,
            RedirectAttributes redirectAttributes) {

        try {
            // 1. 유저 조회
            String email = oAuth2User.getAttribute("email");
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("Invalid user"));

            // 2. 입장 서비스 호출
            gameRoomService.joinRoom(roomCode, password, user);

            // 3. 성공 시 해당 방으로 리다이렉트
            return "redirect:/room/" + roomCode;

        } catch (Exception e) {
            // 4. 실패 시 (정원초과, 비번오류, 게임중 등) 로비로 돌려보내고 에러 메시지 표시
            redirectAttributes.addFlashAttribute("error", e.getMessage());
            return "redirect:/lobby";
        }
    }

    /**
     * ⭐️ 신규: 방 나가기
     */
    @PostMapping("/room/leave")
    public String leaveRoom(@AuthenticationPrincipal OAuth2User oAuth2User) {
        String email = oAuth2User.getAttribute("email");
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid user"));

        gameRoomService.leaveRoom(user);

        return "redirect:/lobby";
    }

    /**
     * ⭐️ 6. 게임방 페이지 (경로 수정 없음, /room/{roomCode} 그대로 사용)
     * (예: /room/1234)
     */
    @GetMapping("/room/{roomCode}")
    public String gameRoomPage(
            @PathVariable String roomCode,
            Model model,
            @AuthenticationPrincipal OAuth2User oAuth2User) {

        // TODO: (다음 단계) 이 방에 현재 유저가 참여했는지, 방이 존재하는지 등 검증 로직 필요
        String email = oAuth2User.getAttribute("email");
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid user"));

        model.addAttribute("roomCode", roomCode);
        model.addAttribute("currentUserId", user.getId()); // ⭐️ JS에서 본인 식별용
        model.addAttribute("currentUsername", user.getUsername());
        return "game-room";
    }
}