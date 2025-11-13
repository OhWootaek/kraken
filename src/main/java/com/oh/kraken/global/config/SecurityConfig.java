package com.oh.kraken.global.config;

import com.oh.kraken.global.auth.CustomOAuth2SuccessHandler;
import com.oh.kraken.global.auth.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final CustomOAuth2SuccessHandler customOAuth2SuccessHandler;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. CSRF 설정 (기존 disable 유지 또는 h2-console만 예외 처리)
                .csrf(csrf -> csrf
                        //.ignoringRequestMatchers("/h2-console/**", "/login/guest") // 게스트 로그인 활성화
                        .ignoringRequestMatchers("/h2-console/**")
                        .disable() // (또는 개발 중엔 전체 비활성화 유지)
                )
                // 2. H2 콘솔 사용을 위한 Frame 옵션 해제 (필수!)
                .headers(headers -> headers
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                )

                // 3. 인가(권한) 설정
                .authorizeHttpRequests(authz -> authz
                        // 모두 허용 (로그인 페이지, 루트, CSS/JS 등)
                        .requestMatchers("/", "/login", "/register-username", "/css/**", "/js/**", "/h2-console/**").permitAll() // 구글로그인
                        //.requestMatchers("/", "/guest-login", "/login/guest", "/css/**", "/js/**", "/h2-console/**").permitAll() // 게스트 로그인
                        // "GUEST" 권한만 접근 가능
                        .requestMatchers("/register-username").hasRole("GUEST")
                        // "USER" 권한만 접근 가능 (로비, 게임방 등)
                        .requestMatchers("/lobby", "/game/**", "mypage/**", "/room/**").hasRole("USER")
                        // 그 외 모든 요청은 인증만 되면 됨
                        .anyRequest().authenticated()
                )

                // 4. OAuth2 로그인 설정
                .oauth2Login(oauth2 -> oauth2
                        .loginPage("/login") // 커스텀 로그인 페이지
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService) // 유저 로드 서비스
                        )
                        .successHandler(customOAuth2SuccessHandler) // 로그인 성공 후 핸들러
                ) // 잠시 주석 처리

                // 2. 임시 폼 로그인 설정
                /*.formLogin(form -> form
                        .loginPage("/guest-login")    // 커스텀 로그인 페이지
                        //.loginProcessingUrl("/login/guest") // 이 URL로 폼을 전송 (우리가 직접 처리)
                        .permitAll()
                )*/

                // 5. 로그아웃 설정
                .logout(logout -> logout
                        .logoutSuccessUrl("/") // 로그아웃 성공 시 루트로 이동
                        .invalidateHttpSession(true)
                );

        return http.build();
    }
}