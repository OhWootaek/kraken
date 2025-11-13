let stompClient = null;

// 1. 페이지 로드 시, 웹소켓 연결 및 방 목록 최초 로드
document.addEventListener('DOMContentLoaded', () => {
    // 1-1. 웹소켓 연결
    connectWebSocket();
    // 1-2. 방 목록 최초 로드
    fetchRoomList();

    // 1-3. 검색 버튼 이벤트
    document.getElementById('search-btn').addEventListener('click', searchRoom);

    // 1-4. 모달 관련 로직 (하나의 리스너로 통합)
    const modal = document.getElementById('createRoomModal');
    const createBtn = document.getElementById('createRoomBtn');
    const closeBtn = document.getElementById('closeModalBtn');

    // "게임방 생성" 버튼 클릭 시 모달 열기
    if (createBtn) {
        createBtn.onclick = () => {
            modal.classList.remove('hidden');
        };
    }

    // "X" 버튼 클릭 시 모달 닫기
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }

    // 모달 바깥 클릭 시 닫기
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    };
});

// 2. STOMP 웹소켓 연결
function connectWebSocket() {
    const socket = new SockJS('/ws-stomp'); // SecurityConfig에 설정된 엔드포인트
    stompClient = Stomp.over(socket);

    stompClient.connect({}, (frame) => {
        console.log('Connected: ' + frame);

        // 로비 갱신 토픽 구독
        stompClient.subscribe('/topic/lobby/update', (message) => {
            console.log('Lobby update signal received!');
            // "갱신하라"는 알림을 받으면, 방 목록 API를 다시 호출
            fetchRoomList();
        });
    });
}

// 3. (API) 방 목록 조회 및 화면 렌더링
async function fetchRoomList() {
    try {
        const response = await fetch('/api/rooms');
        if (!response.ok) throw new Error('Failed to fetch rooms');

        const rooms = await response.json();
        renderRoomList(rooms);
    } catch (error) {
        console.error('Error fetching room list:', error);
    }
}

// 4. (API) 방 코드 검색
async function searchRoom() {
    const code = document.getElementById('search-code').value;
    if (code.length !== 4) {
        alert('4자리 코드를 입력하세요.');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/search?code=${code}`);
        if (!response.ok) {
            alert('방을 찾을 수 없습니다.');
            return;
        }

        const room = await response.json();
        // 검색 성공 시, 해당 방 하나만 목록에 표시 (UX는 선택)
        renderRoomList([room]);
        alert(`[${room.title}] 방을 찾았습니다.`);

        // (UX 개선: 혹은 바로 입장 페이지로 리디렉션)
        // window.location.href = `/rooms/${room.roomCode}`;

    } catch (error) {
        console.error('Error searching room:', error);
    }
}

// 5. (Rendering) 방 목록을 HTML 테이블로 렌더링
function renderRoomList(rooms) {
    const tbody = document.getElementById('room-list-body');
    tbody.innerHTML = ''; // 기존 목록 비우기

    if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">대기중인 방이 없습니다.</td></tr>';
        return;
    }

    // Tailwind 클래스가 적용된 <td> 셀을 생성하는 헬퍼 함수
    const createCell = (text, classes = '') => {
        const td = document.createElement('td');
        // 공통 셀 스타일
        td.className = `px-4 py-4 whitespace-nowrap text-sm text-gray-700 ${classes}`;
        td.textContent = text;
        return td;
    };

    rooms.forEach(room => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';

        // 방 제목 (가중치)
        tr.appendChild(createCell(room.title, 'font-medium text-gray-900'));
        // 방장
        tr.appendChild(createCell(room.hostUsername));
        // 인원
        tr.appendChild(createCell(`${room.currentPlayers} / ${room.maxPlayers}`));
        // 상태 (공개/비공개)
        const statusText = room.public ? '공개방' : '비공개';
        const statusClass = room.public ? 'text-green-600' : 'text-red-600';
        tr.appendChild(createCell(statusText, `font-medium ${statusClass}`));

        // 입장 버튼
        const joinCell = document.createElement('td');
        joinCell.className = 'px-4 py-4 whitespace-nowrap text-sm';

        const joinBtn = document.createElement('button');
        joinBtn.onclick = () => joinRoom(room.roomCode, room.public);

        // Tailwind 기본 버튼 스타일
        joinBtn.className = 'px-3 py-1 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';

        if (room.currentPlayers >= room.maxPlayers || room.status !== 'WAITING') {
            joinBtn.disabled = true;
            joinBtn.textContent = room.status === 'PLAYING' ? '게임중' : '꽉참';
            // Tailwind 비활성화 버튼 스타일
            joinBtn.classList.add('bg-gray-200', 'text-gray-500', 'cursor-not-allowed');
        } else {
            joinBtn.textContent = '입장';
            // Tailwind 활성화 버튼 스타일
            joinBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'focus:ring-blue-500');
        }

        joinCell.appendChild(joinBtn);
        tr.appendChild(joinCell);

        tbody.appendChild(tr);
    });

    /**
     * 방 입장 처리 (비밀번호 묻기)
     */
    function joinRoom(roomCode, isPublic) {
        let password = null;

        if (!isPublic) {
            password = prompt("비밀번호 4자리를 입력하세요.");
            if (password === null) { // 사용자가 '취소'를 누른 경우
                return;
            }
        }

        // POST 요청을 보내기 위한 동적 폼 생성
        postJoinRequest(roomCode, password);
    }

    /**
     * 동적 폼을 생성하여 POST + Redirect 처리
     */
    function postJoinRequest(roomCode, password) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/room/join';

        // 1. 방 코드
        const codeInput = document.createElement('input');
        codeInput.type = 'hidden';
        codeInput.name = 'roomCode';
        codeInput.value = roomCode;
        form.appendChild(codeInput);

        // 2. 비밀번호 (있을 경우에만)
        if (password) {
            const pwInput = document.createElement('input');
            pwInput.type = 'hidden';
            pwInput.name = 'password';
            pwInput.value = password;
            form.appendChild(pwInput);
        }

        // (CSRF 토큰이 필요하다면 여기에 추가)

        document.body.appendChild(form);
        form.submit();
    }
}