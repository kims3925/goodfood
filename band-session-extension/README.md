# Band Session Helper

Band 세션 쿠키를 수집하여 Bandauto 서버로 전송하는 Chrome Extension입니다.

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `band-session-extension` 폴더 선택

## 사용 방법

1. Band (https://band.us)에 로그인
2. Chrome 우측 상단 Extension 아이콘 클릭
3. **서버 URL** 입력 (예: `http://localhost:3001` 또는 `https://your-server.com`)
4. **채널 ID** 입력 (채널 상세 페이지 URL에서 확인)
5. **세션 저장하기** 버튼 클릭

## 채널 ID 확인 방법

채널 상세 페이지 URL: `http://localhost:3001/sourcing/channel/10`
→ 채널 ID: `10`
