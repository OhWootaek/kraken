package com.oh.kraken.global;

import com.oh.kraken.domain.user.Role;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/")
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
        } else {
            // 4. ROLE_USER 유저 -> 로비로
            return "redirect:/lobby";
        }
    }

    @GetMapping("/login")
    public String login() {
        // return "guest-login"; // guest-login.html
        return "login"; // login.html
    }

    /*@GetMapping("/guest-login")
    public String guestLoginPage() {
        return "guest-login"; // guest-login.html
    }*/ // 임시 추가

    @GetMapping("/register-username")
    public String registerUsernameForm() {
        // SecurityConfig에서 GUEST 권한이 있어야만 접근 가능하도록 설정함
        return "register-username"; // register-username.html
    }

    @GetMapping("/lobby")
    public String lobby() {
        // SecurityConfig에서 USER 권한이 있어야만 접근 가능하도록 설정함
        return "lobby"; // lobby.html
    }
}