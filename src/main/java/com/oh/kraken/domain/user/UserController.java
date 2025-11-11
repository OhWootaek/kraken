package com.oh.kraken.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.oh.kraken.domain.user.dto.UsernameUpdateRequest;

@Controller
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository; // 조회용

    // 1. 닉네임 등록 폼 처리
    @PostMapping("/register-username")
    public String registerUsername(
            @RequestParam String username,
            @AuthenticationPrincipal OAuth2User oAuth2User,
            RedirectAttributes redirectAttributes) {

        String email = oAuth2User.getAttribute("email");

        try {
            userService.registerUsername(email, username);
        } catch (IllegalArgumentException e) {
            // 닉네임 중복 시
            redirectAttributes.addFlashAttribute("error", e.getMessage());
            return "redirect:/register-username"; // 다시 폼으로
        }

        // 성공 시 로비로
        return "redirect:/lobby";
    }

    // 2. 마이페이지 화면 보여주기
    @GetMapping("/mypage")
    public String myPage(@AuthenticationPrincipal OAuth2User oAuth2User, Model model) {
        String email = oAuth2User.getAttribute("email");
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        model.addAttribute("user", user);
        return "mypage"; // 뷰 이름
    }

    // 3. 닉네임 변경 처리
    @PostMapping("/mypage/update-username")
    public String updateUsername(
            UsernameUpdateRequest request,
            @AuthenticationPrincipal OAuth2User oAuth2User,
            RedirectAttributes redirectAttributes) {

        try {
            String email = oAuth2User.getAttribute("email");
            userService.updateUsername(email, request.getNewUsername());
            redirectAttributes.addFlashAttribute("message", "닉네임이 변경되었습니다.");
        } catch (IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }

        return "redirect:/mypage";
    }

    // 4. 회원 탈퇴 처리
    @PostMapping("/mypage/delete")
    public String deleteUser(@AuthenticationPrincipal OAuth2User oAuth2User) {
        String email = oAuth2User.getAttribute("email");
        userService.deleteUser(email);

        return "redirect:/"; // 탈퇴 후 메인으로
    }
}