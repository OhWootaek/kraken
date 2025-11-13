package com.oh.kraken.global;

import com.oh.kraken.domain.room.GameRoom;
import com.oh.kraken.domain.room.GameStatus;
import com.oh.kraken.domain.room.RoomParticipant;
import com.oh.kraken.domain.room.RoomParticipantRepository;
import com.oh.kraken.domain.user.Role;
import com.oh.kraken.domain.user.User;
import com.oh.kraken.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.Optional;

@Controller
@RequiredArgsConstructor
public class PageController {

    // Logger
    private static final Logger log = LoggerFactory.getLogger(PageController.class);

    // 재접속 확인을 위한 DB 조회
    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;

    /*@GetMapping("/")
    public String home() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // 1. 로그인 안 한 유저 (Anonymous)
        if (auth == null || auth instanceof AnonymousAuthenticationToken) {
            return "redirect:/login"; // 게스트 로그인 페이지로
        }

        // 2. 로그인 한 유저 - Role 확인
        boolean isGuest = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> role.equals(Role.ROLE_GUEST.name()));

        if (isGuest) {
            // 3. GUEST 유저 -> 닉네임 등록 페이지로
            return "redirect:/register-username";
        }
        // 4. ROLE_USER 유저 -> 재접속 확인
        Optional<String> redirectUrl = getRedirectUrlIfInGame(auth);
        if (redirectUrl.isPresent()) {
            return redirectUrl.get(); // 게임방으로 리다이렉트
        }
        return "redirect:/lobby";
    }*/
    @GetMapping("/")
    public String home() {
        return "index"; // index.html
    }

    @GetMapping("/login")
    public String login() {
        return "guest-login"; // guest-login.html
        //return "login"; // login.html
    }

    @GetMapping("/guest-login")
    public String guestLoginPage() {
        return "guest-login"; // guest-login.html
    } // 임시 추가

    @GetMapping("/register-username")
    public String registerUsernameForm() {
        // SecurityConfig에서 GUEST 권한이 있어야만 접근 가능하도록 설정함
        return "register-username"; // register-username.html
    }

    @GetMapping("/lobby")
    public String lobby() {
        // 로비 직접 접속 시에도 재접속 확인
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Optional<String> redirectUrl = getRedirectUrlIfInGame(auth);
        if (redirectUrl.isPresent()) {
            return redirectUrl.get(); // 게임방으로 리다이렉트
        }

        // SecurityConfig에서 USER 권한이 있어야만 접근 가능하도록 설정함
        return "lobby"; // lobby.html
    }

    /**
     * 재접속 확인 헬퍼 메서드
     */
    private Optional<String> getRedirectUrlIfInGame(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof OAuth2User oAuth2User)) {
            return Optional.empty();
        }

        String email = oAuth2User.getAttribute("email");
        if (email == null) {
            return Optional.empty();
        }

        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            return Optional.empty(); // (이론상 발생 안 함)
        }

        // DB에서 유저의 현재 참여 정보를 찾음
        Optional<RoomParticipant> participantOpt = roomParticipantRepository.findByUserId(userOpt.get().getId());

        if (participantOpt.isPresent()) {
            GameRoom room = participantOpt.get().getGameRoom();

            // 대기중이거나, 게임중인 방이 있다면
            if (room.getStatus() == GameStatus.WAITING || room.getStatus() == GameStatus.PLAYING) {
                //log.info("User {} is already in room {}. Redirecting to game.", email, room.getRoomCode());
                return Optional.of("redirect:/room/" + room.getRoomCode());
            }
        }

        return Optional.empty();
    }
}