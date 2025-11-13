// --------------------------------------------------
// 1. 전역 변수 및 초기화
// --------------------------------------------------
let stompClient = null;
let myPlayerId = currentUserId;

// HTML 요소 변수 (PC + Mobile)
let participantList, playerCount;
let chatWindow, chatMessages, chatForm, chatInput, readyBtn, hostControls;
// 모바일용 변수
let participantListMobile, playerCountMobile;
let chatWindowMobile, chatMessagesMobile, chatFormMobile, chatInputMobile, readyBtnMobile, hostControlsMobile;
let gameInfoDiv, gameBoardArea, mainTitle, gameResultScreen;
let modalOverlay, modalContainer, modalTitle, modalContent;
let modalCloseBtn;

// 모달 컨텐츠 영역
let playersContent, chatContent, controlsContent;

document.addEventListener('DOMContentLoaded', () => {
    participantList = document.getElementById('participant-list');
    playerCount = document.getElementById('player-count');
    chatWindow = document.getElementById('chat-window');
    chatMessages = document.getElementById('chat-messages');
    chatForm = document.getElementById('chat-form');
    chatInput = document.getElementById('chat-input');
    readyBtn = document.getElementById('ready-btn');
    hostControls = document.getElementById('host-controls');

    // 모바일용 요소 할당
    participantListMobile = document.getElementById('participant-list-mobile');
    playerCountMobile = document.getElementById('player-count-mobile');
    chatWindowMobile = document.getElementById('chat-window-mobile');
    chatMessagesMobile = document.getElementById('chat-messages-mobile');
    chatFormMobile = document.getElementById('chat-form-mobile');
    chatInputMobile = document.getElementById('chat-input-mobile');
    readyBtnMobile = document.getElementById('ready-btn-mobile');
    hostControlsMobile = document.getElementById('host-controls-mobile');

    gameInfoDiv = document.getElementById('game-info');
    gameBoardArea = document.getElementById('game-board-area');
    mainTitle = document.getElementById('main-title');
    gameResultScreen = document.getElementById('game-result-screen');

    modalOverlay = document.getElementById('modal-overlay');
    modalContainer = document.getElementById('modal-container');
    modalTitle = document.getElementById('modal-title');
    modalContent = document.getElementById('modal-content');
    modalCloseBtn = document.getElementById('modal-close-btn');

    // 모바일 "컨텐츠" 영역
    playersContent = document.getElementById('modal-content-players');
    chatContent = document.getElementById('modal-content-chat');
    controlsContent = document.getElementById('modal-content-controls');

    // 모바일 UI 이벤트 설정
    setupMobileEventListeners();

    connectWebSocket();

    // 준비 버튼 이벤트
    if(readyBtn) readyBtn.addEventListener('click', sendToggleReady);
    if(readyBtnMobile) readyBtnMobile.addEventListener('click', sendToggleReady);

    // 채팅 전송 이벤트
    if(chatForm) chatForm.addEventListener('submit', (e) => sendChatMessage(e, chatInput));
    if(chatFormMobile) chatFormMobile.addEventListener('submit', (e) => sendChatMessage(e, chatInputMobile));

    if(document.getElementById('start-game-btn')) {
        document.getElementById('start-game-btn').addEventListener('click', sendStartGame);
    }
    if(document.getElementById('start-game-btn-mobile')) {
        document.getElementById('start-game-btn-mobile').addEventListener('click', sendStartGame);
    }
    if(document.getElementById('max-players-select')) {
        document.getElementById('max-players-select').addEventListener('change', (e) => {
            sendChangeMaxPlayers(e.target.value);
        });
    }
    if(document.getElementById('max-players-select-mobile')) {
        document.getElementById('max-players-select-mobile').addEventListener('change', (e) => {
            sendChangeMaxPlayers(e.target.value);
        });
    }
});

/**
 * 모바일 "이벤트 리스너"만 설정
 */
function setupMobileEventListeners() {
    const isMobile = window.innerWidth < 768; // 768px = Tailwind 'md'

    if (isMobile) {
        // 5. 모바일 탭 바 버튼 이벤트
        const showPlayersBtn = document.getElementById('show-players-btn');
        const showChatBtn = document.getElementById('show-chat-btn');
        const showControlsBtn = document.getElementById('show-controls-btn');

        if(showPlayersBtn) showPlayersBtn.addEventListener('click', () => {
            showModal('참여자', playersContent);
        });
        if(showChatBtn) showChatBtn.addEventListener('click', () => {
            showModal('채팅', chatContent);
        });
        if(showControlsBtn) showControlsBtn.addEventListener('click', () => {
            showModal('방 컨트롤', controlsContent);
        });

        // 6. 모달 닫기 이벤트
        if(modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
        if(modalOverlay) modalOverlay.addEventListener('click', hideModal);
    }
}

/**
 * 모달(팝업)을 여는 헬퍼 함수
 */
function showModal(title, contentElement) {
    // 1. 모든 컨텐츠 숨기기
    if(playersContent) playersContent.classList.add('hidden');
    if(chatContent) chatContent.classList.add('hidden');
    if(controlsContent) controlsContent.classList.add('hidden');

    // 2. 요청된 컨텐츠만 보이기
    if (contentElement) {
        contentElement.classList.remove('hidden');
    }

    // 3. 제목 설정
    modalTitle.textContent = title;

    // 4. 오버레이/모달 보이기
    modalOverlay.classList.remove('hidden');
    void modalContainer.offsetWidth;
    modalContainer.classList.add('show');
}

/**
 *  모달(팝업)을 닫는 헬퍼 함수
 */
function hideModal() {
    modalContainer.classList.remove('show');
    modalOverlay.classList.add('hidden');

    // (컨텐츠를 이동할 필요 없음)
}
// --------------------------------------------------
// 2. WebSocket 연결 및 구독
// --------------------------------------------------
function connectWebSocket() {
    const socket = new SockJS('/ws-stomp');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, (frame) => {
        console.log('Connected to game room: ' + frame);

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

        // 3. 인게임 상태 갱신 구독
        stompClient.subscribe(`/user/topic/room/${currentRoomCode}/game-state`, (message) => {
            console.log('In-Game state update received');
            const gameState = JSON.parse(message.body);
            renderInGameState(gameState.commonState, gameState.myState);
        });

        // 4. 게임 종료 알림 구독
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

        // 4. [1:1, 실시간] 방장 전용 에러 구독
        // @MessageExceptionHandler가 여기로 메시지를 보냄
        stompClient.subscribe(`/user/topic/room/errors`, (message) => {
            const errorMessage = JSON.parse(message.body);
            console.error('Host Error:', errorMessage.error);
            const errorDiv = document.getElementById('host-error');
            const errorDivMobile = document.getElementById('host-error-mobile');
            errorDiv.textContent = `[에러] ${errorMessage.error}`;
            errorDivMobile.textContent = `[에러] ${errorMessage.error}`;
            // 3초 뒤 에러 메시지 자동 삭제
            setTimeout(() => { errorDiv.textContent = ''; }, 3000);
            setTimeout(() => { errorDivMobile.textContent = ''; }, 3000);
        });

        // 5. 1:1 강퇴 알림 구독
        stompClient.subscribe(`/user/topic/room/action`, (message) => {
            const actionMessage = message.body;

            // 디버깅을 위해 console.log 추가
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
function sendChatMessage(event, inputElement) {
    event.preventDefault();
    const messageContent = inputElement.value.trim();

    if (messageContent && stompClient && stompClient.connected) {
        const chatMessage = { message: messageContent };
        stompClient.send(`/app/room/${currentRoomCode}/chat`, {}, JSON.stringify(chatMessage));
        inputElement.value = '';
    }
}

// 강퇴 요청 전송
function sendKickPlayer(usernameToKick) {
    if (confirm(`${usernameToKick} 님을 강퇴하시겠습니까?`)) {
        if (stompClient && stompClient.connected) {
            const kickRequest = { username: usernameToKick };
            stompClient.send(`/app/room/${currentRoomCode}/kick`, {}, JSON.stringify(kickRequest));
        }
    }
}

// 최대 인원 변경 전송
function sendChangeMaxPlayers(maxPlayers) {
    if (stompClient && stompClient.connected) {
        const configRequest = { maxPlayers: parseInt(maxPlayers, 10) };
        stompClient.send(`/app/room/${currentRoomCode}/config/max-players`, {}, JSON.stringify(configRequest));
    }
}

// 게임 시작 전송
function sendStartGame() {
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/room/${currentRoomCode}/start`, {}, {});
    }
}

/**
 * 카드 선택 메시지 전송
 */
function sendSelectCard(ownerUserId, selectedCardId) {
    if (stompClient && stompClient.connected) {
        const selectRequest = {
            targetPlayerId: ownerUserId,
            selectedCardId: selectedCardId
        };
        console.log("Sending card selection:", selectRequest);
        stompClient.send(`/app/room/${currentRoomCode}/select-card`, {}, JSON.stringify(selectRequest));
    }
}

// --------------------------------------------------
// 4. 화면 렌더링 (Render)
// --------------------------------------------------

/**
 * 3. 방 상태 렌더링 (참여자 목록, 준비 상태, 방장 UI)
 */
function renderWaitingRoomState(roomState) {

    // 3-1. (amIHost 계산)
    const amIHost = (roomState.hostId === currentUserId);

    // 게임이 시작되면 이 렌더러는 무시
    if (roomState.status === 'PLAYING') {

        if(mainTitle) mainTitle.textContent = "게임 진행 중";
        if(gameBoardArea) gameBoardArea.textContent = "게임 정보를 불러오는 중...";
        if(readyBtn) readyBtn.style.display = 'none';
        if(readyBtnMobile) readyBtnMobile.style.display = 'none';
        if(hostControls) hostControls.style.display = 'none';
        if(hostControlsMobile) hostControlsMobile.style.display = 'none';
        if(gameInfoDiv) gameInfoDiv.style.display = 'block';

        // 서버에 1:1 인게임 상태 요청 (필수)
        if (stompClient && stompClient.connected) {
            console.log("Sending request for my in-game state...");
            stompClient.send(`/app/room/${currentRoomCode}/request-game-state`, {});
        }
        return;

    }

    // 3-2. 참여자 수 갱신 (기존 코드 호환성)
    // 참여자 수 (PC/모바일)
    if(playerCount) playerCount.textContent = `${roomState.participants.length} / ${roomState.maxPlayers}`;
    if(playerCountMobile) playerCountMobile.textContent = `${roomState.participants.length} / ${roomState.maxPlayers}`;

    const maxPlayersSelect = document.getElementById('max-players-select');
    const maxPlayersSelectMobile = document.getElementById('max-players-select-mobile');

    // --- 아직 대기 중인 경우 ---
    mainTitle.textContent = "게임 대기실";
    gameBoardArea.textContent = "모두 준비가 완료되면 방장이 게임을 시작합니다.";

    // 3-3. 방장 UI 갱신
    if (amIHost) {
        if(hostControls) hostControls.style.display = 'block';
        if(hostControlsMobile) hostControlsMobile.style.display = 'block';

        if(maxPlayersSelect) maxPlayersSelect.value = roomState.maxPlayers;
        if(maxPlayersSelectMobile) maxPlayersSelectMobile.value = roomState.maxPlayers;

        if(readyBtn) readyBtn.style.display = 'none';
        if(readyBtnMobile) readyBtnMobile.style.display = 'none';
    } else {
        if(hostControls) hostControls.style.display = 'none';
        if(hostControlsMobile) hostControlsMobile.style.display = 'none';

        if(readyBtn) readyBtn.style.display = 'block';
        if(readyBtnMobile) readyBtnMobile.style.display = 'block';
    }

    // 3-4. 강퇴당했는지 2차 확인
    const amIKicked = !roomState.participants.some(p => p.userId === currentUserId);
    if (amIKicked) {
        // (1:1 강퇴 메시지를 이미 받았겠지만, 2차 방어)
        console.log("KICK detected by broadcast (amIKicked). Firing alert.");
        alert('방에서 퇴장되었습니다. 로비로 이동합니다.');
        window.location.href = '/lobby';
        return; // 렌더링 중단
    }

    // 3-5. 참여자 목록 갱신 (기존 + 신규 병합)
    // 참여자 목록 갱신 (PC/모바일)
    if(participantList) participantList.innerHTML = '';
    if(participantListMobile) participantListMobile.innerHTML = '';

    roomState.participants.forEach(p => {
        const li_pc = createParticipantLi(p, roomState.hostId, amIHost);
        const li_mobile = createParticipantLi(p, roomState.hostId, amIHost);

        if(participantList) participantList.appendChild(li_pc);
        if(participantListMobile) participantListMobile.appendChild(li_mobile);
    });
}

/**
 * 참여자 <li> 요소를 생성 (PC/모바일 공용)
 */
function createParticipantLi(p, hostId, amIHost) {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'flex items-center space-x-2';

    const nameSpan = document.createElement('span');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'px-2 py-0.5 text-xs font-semibold rounded-full';

    if (p.ready) {
        statusBadge.textContent = 'Ready';
        statusBadge.classList.add('bg-green-100', 'text-green-800');
        nameSpan.classList.add('ready');
    } else {
        statusBadge.textContent = 'Waiting';
        statusBadge.classList.add('bg-gray-100', 'text-gray-600');
        nameSpan.classList.add('not-ready');
    }

    let youMark = '';
    if (p.userId === myPlayerId) {
        youMark = ' (You)';
        nameSpan.style.fontWeight = 'bold';
    }
    let hostMark = '';
    if (p.userId === hostId) {
        hostMark = '[방장] ';
    }
    nameSpan.textContent = `${hostMark}${p.username}${youMark}`;

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(statusBadge);
    li.appendChild(infoDiv);

    if (amIHost && p.userId !== myPlayerId) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = '강퇴';
        kickBtn.className = 'px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1';
        kickBtn.onclick = () => sendKickPlayer(p.username);

        if (p.ready) {
            kickBtn.disabled = true;
            kickBtn.title = '준비 완료 상태인 유저는 강퇴할 수 없습니다.';
            kickBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        li.appendChild(kickBtn);
    }
    return li;
}

/**
 * 4-2: 인게임 상태 렌더링
 */
function renderInGameState(commonState, myState) {
    // 1. 대기실 UI 숨기기
    if(mainTitle) mainTitle.textContent = "게임 진행 중";
    if(readyBtn) readyBtn.style.display = 'none';
    if(readyBtnMobile) readyBtnMobile.style.display = 'none';
    if(hostControls) hostControls.style.display = 'none';
    if(hostControlsMobile) hostControlsMobile.style.display = 'none';
    if(gameInfoDiv) gameInfoDiv.style.display = 'block';


    // 게임 정보 (PC/모바일)
    document.querySelectorAll('#game-round').forEach(el => el.textContent = commonState.currentRound);
    document.querySelectorAll('#treasures-found').forEach(el => el.textContent = commonState.treasuresFound);
    document.querySelectorAll('#treasures-total').forEach(el => el.textContent = commonState.treasuresTotal);

    // 나의 정보 (PC/모바일)
    document.querySelectorAll('#my-role').forEach(el => renderRole(el, myState.myRole));
    document.querySelectorAll('#my-hand').forEach(el => renderHand(el, myState.myHand));


    // 참여자 목록 갱신 (턴 표시)
    const lists = [participantList, participantListMobile];
    lists.forEach(list => {
        if(list) {
            list.innerHTML = '';
            commonState.players.forEach(p => {
                const li = document.createElement('li');
                li.className = 'p-1';
                let content = p.username;
                if (p.userId === myPlayerId) {
                    li.style.fontWeight = 'bold';
                    content += ' (You)';
                }
                if (p.userId === commonState.currentTurnPlayerId) {
                    li.classList.add('my-turn');
                    content = '➡️ ' + content + ' <span class="px-2 py-0.5 ml-1 text-xs font-bold text-yellow-800 bg-yellow-200 rounded-full">Turn</span>';
                }
                li.innerHTML = content;
                list.appendChild(li);
            });
        }
    });

    // 5. 메인 게임 보드 렌더링
    if(gameBoardArea) gameBoardArea.innerHTML = ''; // 보드 비우기
    const isMyTurn = (commonState.currentTurnPlayerId === myPlayerId);

    // 라운드 딜레이 중 UI
    if (commonState.awaitingNextRound) {
        if(gameBoardArea) gameBoardArea.innerHTML = '<h4 class="text-lg font-bold text-blue-600">라운드 종료. 3초 후 다음 라운드를 준비합니다...</h4>';
    } else if (isMyTurn) {
        if(gameBoardArea) gameBoardArea.innerHTML += '<h4 class="text-lg font-bold text-green-600">당신의 턴입니다. 다른 플레이어의 카드를 선택하세요.</h4>';
    } else {
        if(gameBoardArea) gameBoardArea.innerHTML += '<h4 class="text-lg font-semibold text-gray-600">다른 플레이어의 턴을 기다리는 중...</h4>';
    }

    // 중앙 공개 더미 렌더링
    const revealedPileDiv = document.createElement('div');
    revealedPileDiv.innerHTML = `<strong class="mt-4 mb-2 block text-gray-700">공개된 카드 더미 (${commonState.revealedCardsPile.length}장)</strong>`;
    const revealedCardsContainer = document.createElement('div');
    revealedCardsContainer.style.display = 'flex';
    revealedCardsContainer.className = 'cards';

    if (commonState.revealedCardsPile.length === 0) {
        revealedCardsContainer.innerHTML = '<p class="text-sm text-gray-500">아직 공개된 카드가 없습니다.</p>';
    } else{
        commonState.revealedCardsPile.forEach(cardType => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card revealed';
            addCardStyle(cardDiv, cardType);
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
        cardsDiv.style.display = 'flex';
        cardsDiv.className = 'cards';

        // (card, index) -> card 객체 순회
        p.placedCards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';

            // 리팩토링된 DTO 로직
            if (card.revealed) {
                // "뒤집힌" 카드
                cardDiv.classList.add('revealed');
                // "카드가 빈 상자로 보이는" 버그 수정
                addCardStyle(cardDiv, card.cardType);
            } else {
                // "뒷면" 카드
                if (isMyTurn && !card.mine && !commonState.awaitingNextRound) {
                    // 내 턴이고, 남의 카드일 때
                    cardDiv.title = `Click to reveal ${p.username}'s card`;
                    // sendSelectCard(ownerUserId, cardId)
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
        if(gameBoardArea) gameBoardArea.appendChild(playerBoard);
    });
}

/**
 * 게임 종료 처리
 */
function handleGameEnd(result) {
    console.log("Handling Game End. Winner:", result.winnerRole);

    // 모든 게임 UI 숨기기
    if(document.querySelector('.sidebar')) document.querySelector('.sidebar').style.display = 'none';
    if(document.querySelector('.main-game')) document.querySelector('.main-game').style.display = 'none';
    if(document.getElementById('mobile-nav')) document.getElementById('mobile-nav').style.display = 'none';
    if(modalOverlay) modalOverlay.style.display = 'none';
    if(modalContainer) modalContainer.style.display = 'none';


    // 결과 화면 표시
    if(gameResultScreen) gameResultScreen.style.display = 'flex';

    const winnerText = result.winnerRole === 'EXPLORER' ? '탐험대' : '스켈레톤';
    if(document.getElementById('result-winner')) document.getElementById('result-winner').textContent = `${winnerText} 승리!`;
    if(document.getElementById('result-winner')) document.getElementById('result-winner').className = (result.winnerRole === 'EXPLORER') ? 'text-3xl font-bold mb-6 text-blue-600' : 'text-3xl font-bold mb-6 text-red-600';
    if(document.getElementById('result-treasures')) document.getElementById('result-treasures').textContent = `${result.treasuresFound} / ${result.treasuresTotal}`;
    if(document.getElementById('result-kraken')) document.getElementById('result-kraken').textContent = result.krakenFound ? '발견됨 🐙' : '발견되지 않음';

    // 플레이어 역할 목록 렌더링
    const resultList = document.getElementById('result-player-list');
    if(resultList) resultList.innerHTML = '';
    result.players.forEach(p => {
        const li = document.createElement('li');

        const roleSpan = document.createElement('span');
        renderRole(roleSpan, p.role); // 헬퍼 함수 재사용

        li.textContent = `${p.username}: `;
        li.appendChild(roleSpan);
        if (p.role === 'SKELETON') {
            li.classList.add('SKELETON');
        }
        if(resultList) resultList.appendChild(li);
    });

    // (10초 후 로비로 이동)
    setTimeout(() => {
        window.location.href = '/lobby';
    }, 10000);
}

// (새 채팅 메시지 갱신)
function renderChatMessage(message) {
    const li_pc = document.createElement('li');
    li_pc.innerHTML = `<strong>${message.senderUsername}:</strong> ${message.message}`;

    const li_mobile = document.createElement('p');
    li_mobile.innerHTML = `<strong>${message.senderUsername}:</strong> ${message.message}`;

    if (chatMessages) {
        chatMessages.appendChild(li_pc);
    }
    if (chatMessagesMobile) {
        chatMessagesMobile.appendChild(li_mobile);
    }

    // 스크롤을 맨 아래로 내림
    if(chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    if(chatWindowMobile) chatWindowMobile.scrollTop = chatWindowMobile.scrollHeight;
}

// --------------------------------------------------
// 5. 헬퍼 함수들
// --------------------------------------------------

/**
 * 역할(Role) 텍스트/스타일 렌더링
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
 * 손패(Hand) 텍스트/스타일 렌더링
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
 * 카드(Card) 텍스트/스타일 렌더링 (손패용)
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
 * 뒤집힌 카드(Card Box) 스타일/아이콘 렌더링 (보드용)
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