// --------------------------------------------------
// 1. 전역 변수 및 초기화
// --------------------------------------------------
let stompClient = null;
let myPlayerId = currentUserId; // ⭐️ HTML에서 currentUserId를 myPlayerId로 사용

// HTML 요소 캐시
const participantList = document.getElementById('participant-list');
const playerCount = document.getElementById('player-count');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const readyBtn = document.getElementById('ready-btn');

// ⭐️ 4-2: 인게임 UI 요소
const gameInfoDiv = document.getElementById('game-info');
const gameBoardArea = document.getElementById('game-board-area');
const mainTitle = document.getElementById('main-title');

// ⭐️ 5-3: 게임 결과 UI
const gameResultScreen = document.getElementById('game-result-screen');

document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();

    // 준비 버튼 이벤트
    readyBtn.addEventListener('click', sendToggleReady);

    // 채팅 전송 이벤트
    chatForm.addEventListener('submit', sendChatMessage);

    // ⭐️ 3-2: 방장 컨트롤 이벤트 리스너 추가
    document.getElementById('start-game-btn').addEventListener('click', sendStartGame);
    document.getElementById('max-players-select').addEventListener('change', (e) => {
        sendChangeMaxPlayers(e.target.value);
    });
});

// --------------------------------------------------
// 2. WebSocket 연결 및 구독
// --------------------------------------------------
function connectWebSocket() {
    const socket = new SockJS('/ws-stomp');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, (frame) => {
        console.log('Connected to game room: ' + frame);

        /*
         * ⭐️⭐️⭐️ [수정된 핵심 로직] ⭐️⭐️⭐️
         * 구독을 2단계로 분리합니다.
         */

        // 1. [1회성] 현재 방 상태 즉시 요청 ( @SubscribeMapping 호출 )
        stompClient.subscribe(`/app/room/${currentRoomCode}/state`, (message) => {
            console.log('Initial room state received');
            const roomState = JSON.parse(message.body);
            renderWaitingRoomState(roomState);
        });

        // 2. [실시간] 방 상태 갱신 구독 ( 브로드캐스팅 )
        stompClient.subscribe(`/topic/room/${currentRoomCode}/state`, (message) => {
            console.log('Room state update received');
            const roomState = JSON.parse(message.body);
            renderWaitingRoomState(roomState);
        });

        // ⭐️ 3. [신규] 4-2: 인게임 상태 갱신 구독
        stompClient.subscribe(`/user/topic/room/${currentRoomCode}/game-state`, (message) => {
            console.log('In-Game state update received');
            const gameState = JSON.parse(message.body);
            renderInGameState(gameState.commonState, gameState.myState);
        });

        // 4. ⭐️ [신규] 4-3: 게임 종료 알림 구독
        stompClient.subscribe(`/topic/room/${currentRoomCode}/game-result`, (message) => {
            //const winnerRole = message.body; // "EXPLORER" 또는 "SKELETON"
            const result = JSON.parse(message.body);
            console.log("Game End message received. Winner:", result);
            handleGameEnd(result);
        });

        // 3. [실시간] 채팅 구독
        stompClient.subscribe(`/topic/room/${currentRoomCode}/chat`, (message) => {
            const chatMessage = JSON.parse(message.body);
            renderChatMessage(chatMessage);
        });

        // ⭐️ 4. [1:1, 실시간] 방장 전용 에러 구독
        // @MessageExceptionHandler가 여기로 메시지를 보냄
        stompClient.subscribe(`/user/topic/room/errors`, (message) => {
            const errorMessage = JSON.parse(message.body);
            console.error('Host Error:', errorMessage.error);
            const errorDiv = document.getElementById('host-error');
            errorDiv.textContent = `[에러] ${errorMessage.error}`;
            // 3초 뒤 에러 메시지 자동 삭제
            setTimeout(() => { errorDiv.textContent = ''; }, 3000);
        });

        // ⭐️ 5. [FIX 1] 1:1 강퇴 알림 구독
        stompClient.subscribe(`/user/topic/room/action`, (message) => {
            const actionMessage = message.body;

            // ⭐️ [FIX] 디버깅을 위해 console.log 추가
            console.log("1:1 Action Message Received:", actionMessage);

            if (actionMessage.includes("강퇴")) {
                console.log("KICK message confirmed. Firing alert.");
                alert("방장에 의해 강퇴당했습니다. 로비로 이동합니다.");
                window.location.href = '/lobby';
            }
        });


    }, (error) => {
        console.error('STOMP Connection Error: ' + error);
        alert('서버 연결이 끊어졌습니다. 로비로 이동합니다.');
        window.location.href = '/lobby';
    });
}

// --------------------------------------------------
// 3. WebSocket 메시지 발송 (Send)
// --------------------------------------------------

// (준비 버튼 클릭 시)
function sendToggleReady() {
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/room/${currentRoomCode}/ready`, {});
    }
}

// (채팅 폼 전송 시)
function sendChatMessage(event) {
    event.preventDefault();
    const messageContent = chatInput.value.trim();

    if (messageContent && stompClient && stompClient.connected) {
        const chatMessage = {
            senderUsername: currentUsername, // ⭐️ 서버에서 채우는 대신 클라이언트에서 전송
            message: messageContent
        };
        stompClient.send(`/app/room/${currentRoomCode}/chat`, {}, JSON.stringify(chatMessage));
        chatInput.value = '';
    }
}

// ⭐️ [FIX 3] (누락된 헬퍼 함수) 강퇴 요청 전송
function sendKickPlayer(usernameToKick) {
    if (confirm(`${usernameToKick} 님을 강퇴하시겠습니까?`)) {
        if (stompClient && stompClient.connected) {
            const kickRequest = { username: usernameToKick };
            stompClient.send(`/app/room/${currentRoomCode}/kick`, {}, JSON.stringify(kickRequest));
        }
    }
}

// ⭐️ [FIX 3] (누락된 헬퍼 함수) 최대 인원 변경 전송
function sendChangeMaxPlayers(maxPlayers) {
    if (stompClient && stompClient.connected) {
        const configRequest = { maxPlayers: parseInt(maxPlayers, 10) };
        stompClient.send(`/app/room/${currentRoomCode}/config/max-players`, {}, JSON.stringify(configRequest));
    }
}

// ⭐️ [FIX 3] (누락된 헬퍼 함수) 게임 시작 전송
function sendStartGame() {
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/room/${currentRoomCode}/start`, {}, {});
    }
}

/**
 * ⭐️ [신규] 4-2: 카드 선택 메시지 전송
 */
function sendSelectCard(ownerUserId, selectedCardId) {
    if (stompClient && stompClient.connected) {
        const selectRequest = {
            targetPlayerId: ownerUserId, // ⭐️ "targetPlayerId"로 수정
            selectedCardId: selectedCardId // ⭐️ "selectedCardId"로 수정
        };
        console.log("Sending card selection:", selectRequest);
        stompClient.send(`/app/room/${currentRoomCode}/select-card`, {}, JSON.stringify(selectRequest));
    }
}

// --------------------------------------------------
// 4. 화면 렌더링 (Render)
// --------------------------------------------------

/**
 * 3. ⭐️ [병합됨] 방 상태 렌더링 (참여자 목록, 준비 상태, 방장 UI)
 */
function renderWaitingRoomState(roomState) {
    // ⭐️ [추가] 4-1: 게임 상태(WAITING / PLAYING)에 따른 UI 변경
    const mainTitle = document.getElementById('main-title');
    const gameBoardArea = document.getElementById('game-board-area');

    // 3-1. (amIHost 계산)
    const amIHost = (roomState.hostId === currentUserId);

    // ⭐️ [추가] 4-2: 게임이 시작되면 이 렌더러는 무시
    if (roomState.status === 'PLAYING') {
        // (broadcastInGameState가 UI를 처리할 것이므로, 여기서는 아무것도 안 함)
        // (단, 페이지 새로고침 시 여기로 올 수 있으므로, 게임 화면으로 강제 갱신)
        console.log("Game is already PLAYING. Requesting full game state...");
        // (서버에 1:1 게임 상태를 요청하는 로직이 필요하지만, 우선 대기)

        // (임시) 게임 시작 UI로 전환
        mainTitle.textContent = "게임 진행 중";
        gameBoardArea.textContent = "게임 정보를 불러오는 중...";
        document.getElementById('ready-btn').style.display = 'none';
        document.getElementById('host-controls').style.display = 'none';
        gameInfoDiv.style.display = 'block';
        return;

    } else {
        // --- 아직 대기 중인 경우 ---
        mainTitle.textContent = "게임 대기실";
        gameBoardArea.textContent = "모두 준비가 완료되면 방장이 게임을 시작합니다.";

        // 3-3. 방장 UI 갱신
        const hostControls = document.getElementById('host-controls');
        const readyBtn = document.getElementById('ready-btn');
        if (amIHost) {
            hostControls.style.display = 'block';
            document.getElementById('max-players-select').value = roomState.maxPlayers;
            readyBtn.style.display = 'none';
        } else {
            hostControls.style.display = 'none';
            readyBtn.style.display = 'block';
        }
    }

    // 3-2. 참여자 수 갱신 (기존 코드 호환성)
    const playerCount = document.getElementById('player-count');
    playerCount.textContent = `${roomState.participants.length} / ${roomState.maxPlayers}`;

    // 3-4. ⭐️ [FIX 2] 강퇴당했는지 2차 확인
    const amIKicked = !roomState.participants.some(p => p.userId === currentUserId);
    if (amIKicked) {
        // (1:1 강퇴 메시지를 이미 받았겠지만, 2차 방어)
        console.log("KICK detected by broadcast (amIKicked). Firing alert.");
        alert('방에서 퇴장되었습니다. 로비로 이동합니다.');
        window.location.href = '/lobby';
        return; // 렌더링 중단
    }

    // 3-5. 참여자 목록 갱신 (기존 + 신규 병합)
    const participantList = document.getElementById('participant-list');
    participantList.innerHTML = ''; // 목록 비우기

    // ⭐️ (DTO에 hostUsername이 없으므로, hostId를 먼저 찾음)
    const hostId = roomState.participants.find(p => p.username === currentUsername && amIHost)
        ? currentUserId
        : (amIHost ? 0 : roomState.participants[0]?.userId); // 임시 방편

    roomState.participants.forEach(p => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span'); // ⭐️ span 생성

        li.className = 'flex justify-between items-center';
        // ⭐️ 이름과 상태를 묶을 div
        const infoDiv = document.createElement('div');
        infoDiv.className = 'flex items-center space-x-2';
        // ⭐️ [FIX 1] 준비 상태 뱃지
        const statusBadge = document.createElement('span');
        statusBadge.className = 'px-2 py-0.5 text-xs font-semibold rounded-full';

        // (기존) 준비 상태 텍스트 및 클래스
        let status = '';
        if (p.ready) {
            status = ' (Ready)';
            statusBadge.textContent = 'Ready';
            statusBadge.classList.add('bg-green-100', 'text-green-800');
            nameSpan.classList.add('ready'); // (기존 글자색 스타일도 유지)
        } else {
            statusBadge.textContent = 'Waiting';
            statusBadge.classList.add('bg-gray-100', 'text-gray-600');
            nameSpan.classList.add('not-ready');
        }

        // (기존) 본인 표시
        let youMark = '';
        if (p.userId === currentUserId) {
            youMark = ' (You)';
            nameSpan.style.fontWeight = 'bold';
        }

        // (신규) 방장 표시 (방장의 ID를 DTO에 추가하는 것이 좋음)
        // (임시) 방장 ID를 찾아서 표시 (가장 좋은 방법은 DTO에 hostId 필드 추가)
        let hostMark = '';
        // (임시) ⭐️ 방장이 자기 자신을 렌더링할 때만 [방장] 표시 (기존 코드 유지)
        if (p.userId === roomState.hostId) {
            hostMark = '[방장] ';
        }


        // 텍스트 조합
        // const nameSpan = document.createElement('span');
        nameSpan.textContent = `${hostMark}${p.username}${youMark}`;
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(statusBadge);
        li.appendChild(infoDiv);

        // (신규) 강퇴 버튼 추가
        if (amIHost && p.userId !== currentUserId) {
            const kickBtn = document.createElement('button');
            kickBtn.textContent = '강퇴';
            kickBtn.className = 'px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1';
            kickBtn.onclick = () => sendKickPlayer(p.username);

            if (p.ready) {
                kickBtn.disabled = true;
                kickBtn.title = '준비 완료 상태인 유저는 강퇴할 수 없습니다.';
                kickBtn.classList.add('opacity-50', 'cursor-not-allowed'); // ⭐️ 비활성화 스타일
            }
            li.appendChild(kickBtn);
        }

        participantList.appendChild(li);
    });
}

/**
 * ⭐️ [신규] 4-2: 인게임 상태 렌더링
 */
function renderInGameState(commonState, myState) {
    // 1. 대기실 UI 숨기기
    mainTitle.textContent = "게임 진행 중";
    document.getElementById('ready-btn').style.display = 'none';
    document.getElementById('host-controls').style.display = 'none';
    gameInfoDiv.style.display = 'block';

    // 2. 게임 정보 패널 표시
    gameInfoDiv.style.display = 'block';
    document.getElementById('game-round').textContent = commonState.currentRound;
    document.getElementById('treasures-found').textContent = commonState.treasuresFound;
    document.getElementById('treasures-total').textContent = commonState.treasuresTotal;

    // ⭐️ [FIX] 3. 나의 비밀 정보 갱신 (한글/색상 적용)
    renderRole(document.getElementById('my-role'), myState.myRole);
    renderHand(document.getElementById('my-hand'), myState.myHand);

    // 3. 나의 비밀 정보 표시 (1:1 DTO)
    // document.getElementById('my-role').textContent = myState.myRole;
    // document.getElementById('my-hand').textContent = myState.myHand.join(', '); // ⭐️ 최초 손패 확인

    // 4. 참여자 목록 갱신 (턴 표시)
    participantList.innerHTML = '';
    commonState.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.username;
        // ⭐️ 현재 턴인 사람 강조
        if (p.userId === commonState.currentTurnPlayerId) {
            li.classList.add('my-turn'); // ⭐️ 노란색 배경
            li.innerHTML += ' <span class="text-sm font-bold text-yellow-700">(Turn)</span>'; // ⭐️ 텍스트 제거 대신 아이콘
        }
        participantList.appendChild(li);
    });

    // 5. 메인 게임 보드 렌더링
    gameBoardArea.innerHTML = ''; // 보드 비우기
    const isMyTurn = (commonState.currentTurnPlayerId === currentUserId);

    // ⭐️ [수정] 5-5: 라운드 딜레이 중 UI
    if (commonState.awaitingNextRound) {
        gameBoardArea.innerHTML = '<h4>라운드 종료. 다음 라운드를 준비합니다...</h4>';
    } else if (isMyTurn) {
        gameBoardArea.innerHTML += '<h4>당신의 턴입니다. 다른 플레이어의 카드를 선택하세요.</h4>';
    } else {
        gameBoardArea.innerHTML += '<h4>다른 플레이어의 턴을 기다리는 중...</h4>';
    }

    // ⭐️ 5b. [FIX 1] 중앙 공개 더미 렌더링
    const revealedPileDiv = document.createElement('div');
    revealedPileDiv.innerHTML = `<strong class="mt-4 mb-2 block text-gray-700">공개된 카드 더미 (${commonState.revealedCardsPile.length}장)</strong>`;
    const revealedCardsContainer = document.createElement('div');
    revealedCardsContainer.className = 'cards'; // ⭐️ 가로 정렬

    if (commonState.revealedCardsPile.length === 0) {
        revealedCardsContainer.innerHTML = '<p class="text-sm text-gray-500">아직 공개된 카드가 없습니다.</p>';
    } else{
        commonState.revealedCardsPile.forEach(cardType => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card revealed'; // 항상 'revealed'
            addCardStyle(cardDiv, cardType); // ⭐️ 헬퍼 함수 호출
            revealedCardsContainer.appendChild(cardDiv);
        });
    }

    revealedPileDiv.appendChild(revealedCardsContainer);
    gameBoardArea.appendChild(revealedPileDiv);
    gameBoardArea.appendChild(document.createElement('hr'));


    // 5c. 플레이어 보드 렌더링
    commonState.players.forEach(p => {
        const playerBoard = document.createElement('div');
        playerBoard.className = 'player-board my-4 p-4 bg-white rounded-lg shadow';
        if (p.userId === commonState.currentTurnPlayerId) {
            playerBoard.classList.add('border-4', 'border-yellow-400');
        }

        playerBoard.innerHTML += `<strong class="text-lg font-semibold text-gray-800">${p.username}</strong> <span class="text-gray-600">(${p.cardCount} cards)</span>`;

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'cards';

        // ⭐️ [FIX] (card, index) -> card 객체 순회
        p.placedCards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';

            // ⭐️ [FIX] 리팩토링된 DTO 로직
            if (card.revealed) {
                // "뒤집힌" 카드
                cardDiv.classList.add('revealed');
                // ⭐️ [FIX] "카드가 빈 상자로 보이는" 버그 수정
                addCardStyle(cardDiv, card.cardType);
            } else {
                // "뒷면" 카드
                if (isMyTurn && !card.mine && !commonState.awaitingNextRound) { // ⭐️ DTO의 'mine' (isMine() -> mine)
                    // 내 턴이고, 남의 카드일 때
                    cardDiv.title = `Click to reveal ${p.username}'s card`;
                    // ⭐️ [FIX 3] sendSelectCard(ownerUserId, cardId)
                    cardDiv.onclick = () => sendSelectCard(p.userId, card.cardId);
                } else if (card.mine) {
                    // 내 카드일 때
                    cardDiv.classList.add('my-card');
                    cardDiv.title = "Your own card (cannot select)";
                } else {
                    // 내 턴이 아닐 때
                    cardDiv.title = "Waiting...";
                }
            }
            cardsDiv.appendChild(cardDiv);
        });

        playerBoard.appendChild(cardsDiv);
        gameBoardArea.appendChild(playerBoard);
    });
}

/**
 * ⭐️ [신규] 5-3: 게임 종료 처리
 */
function handleGameEnd(result) {
    console.log("Handling Game End. Winner:", result.winnerRole);

    // 모든 게임 UI 숨기기
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.main-game').style.display = 'none';

    // 결과 화면 표시
    gameResultScreen.style.display = 'flex'; // ⭐️ flex로 중앙 정렬

    const winnerText = result.winnerRole === 'EXPLORER' ? '탐험대' : '스켈레톤';
    document.getElementById('result-winner').textContent = `${winnerText} 승리!`;
    document.getElementById('result-treasures').textContent = `${result.treasuresFound} / ${result.treasuresTotal}`;
    document.getElementById('result-kraken').textContent = result.krakenFound ? '발견됨 🐙' : '발견되지 않음';

    // 플레이어 역할 목록 렌더링
    const resultList = document.getElementById('result-player-list');
    resultList.innerHTML = '';
    result.players.forEach(p => {
        const li = document.createElement('li');

        const roleSpan = document.createElement('span');
        renderRole(roleSpan, p.role); // ⭐️ 헬퍼 함수 재사용

        li.textContent = `${p.username}: `;
        li.appendChild(roleSpan);
        if (p.role === 'SKELETON') {
            li.classList.add('SKELETON');
        }
        resultList.appendChild(li);
    });

    // (10초 후 로비로 이동)
    setTimeout(() => {
        window.location.href = '/lobby';
    }, 10000);
}

// (새 채팅 메시지 갱신)
function renderChatMessage(message) {
    const p = document.createElement('p'); // ⭐️ 'li'가 아닌 'p'로 되어있던 부분 수정
    p.innerHTML = `<strong>${message.senderUsername}:</strong> ${message.message}`;
    chatWindow.appendChild(p);

    // 스크롤을 맨 아래로 내림
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ⭐️ [FIX 4] (누락된 헬퍼 함수) 강퇴 시 동적 폼 전송
function postLeaveRequest() {
    // 'leave-form' ID가 없으므로 동적으로 생성
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/room/leave';
    document.body.appendChild(form);
    form.submit();
}

// --------------------------------------------------
// 5. ⭐️ [신규] 헬퍼 함수들
// --------------------------------------------------

/**
 * ⭐️ Req 3: 역할(Role) 텍스트/스타일 렌더링
 */
function renderRole(element, role) {
    if (role === 'EXPLORER') {
        element.textContent = '탐험대';
        element.className = 'font-medium role-explorer';
    } else if (role === 'SKELETON') {
        element.textContent = '스켈레톤';
        element.className = 'font-medium role-skeleton';
    } else {
        element.textContent = role;
        element.className = 'font-medium';
    }
}

/**
 * ⭐️ Req 4: 손패(Hand) 텍스트/스타일 렌더링
 */
function renderHand(element, hand) {
    element.innerHTML = ''; // Clear
    if (!hand || hand.length === 0) {
        element.textContent = '손패 없음';
        return;
    }

    hand.forEach((cardType, index) => {
        const cardSpan = document.createElement('span');
        renderCardText(cardSpan, cardType); // 헬퍼 호출
        element.appendChild(cardSpan);
        if (index < hand.length - 1) {
            element.appendChild(document.createTextNode(', '));
        }
    });
}

/**
 * ⭐️ Req 4: 카드(Card) 텍스트/스타일 렌더링 (손패용)
 */
function renderCardText(element, cardType) {
    if (cardType === 'TREASURE') {
        element.textContent = '보물';
        element.className = 'font-bold card-text-treasure';
    } else if (cardType === 'KRAKEN') {
        element.textContent = '크라켄';
        element.className = 'font-bold card-text-kraken';
    } else if (cardType === 'EMPTY_BOX') {
        element.textContent = '빈 상자';
        element.className = 'card-text-empty';
    } else {
        element.textContent = cardType || '?';
    }
}

/**
 * ⭐️ Req 4: 뒤집힌 카드(Card Box) 스타일/아이콘 렌더링 (보드용)
 */
function addCardStyle(cardDiv, cardType) {
    if (cardType === 'KRAKEN') {
        cardDiv.textContent = '🐙';
        cardDiv.classList.add('type-kraken');
    } else if (cardType === 'TREASURE') {
        cardDiv.textContent = '💎';
        cardDiv.classList.add('type-treasure');
    } else { // EMPTY_BOX
        cardDiv.textContent = '📦';
        cardDiv.classList.add('type-empty');
    }
}