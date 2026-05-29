# Band 세션 Extension 설치 가이드

BandAuto의 자동화 기능은 Band에 로그인된 세션을 이용하여 상품 수집 및 게시물 발행을 수행합니다. **Band Session Helper** Chrome Extension은 현재 브라우저의 Band 로그인 세션을 BandAuto 서버에 안전하게 저장하는 역할을 합니다.

---

## 사전 요구 사항

- **Google Chrome** 브라우저 (버전 100 이상 권장)
- Band(band.us) 계정 로그인 상태
- BandAuto 소싱 앱(snsauto.abcpharm.net) 계정 로그인 상태

---

## Extension 설치 방법

Extension은 Chrome 웹 스토어가 아닌 로컬 폴더에서 직접 설치(개발자 모드)합니다.

### 1단계 — Extension 파일 확인

Extension 소스 파일의 위치를 확인합니다.

```
C:\Users\kims3\SNS_AUTO\code\band-session-extension
```

해당 폴더에 아래 파일들이 있는지 확인합니다.

```
band-session-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2단계 — Chrome 개발자 모드 활성화

1. Chrome 브라우저 주소창에 아래 주소를 입력하고 Enter를 누릅니다.

```
chrome://extensions
```

2. 우측 상단의 **개발자 모드** 토글을 클릭하여 활성화합니다.
   - 토글이 파란색으로 바뀌면 개발자 모드가 활성화된 상태입니다.

### 3단계 — Extension 로드

1. **압축해제된 확장 프로그램 로드** 버튼을 클릭합니다.
2. 파일 탐색기가 열리면 아래 경로로 이동합니다.

```
C:\Users\kims3\SNS_AUTO\code\band-session-extension
```

3. 폴더를 선택하고 **폴더 선택** 버튼을 클릭합니다.
4. Extensions 목록에 **Band Session Helper**가 추가되면 설치 완료입니다.

---

## 사이트 접근 권한 확인

Extension이 Band와 BandAuto 사이트에 접근할 수 있어야 합니다.

1. `chrome://extensions` 페이지에서 **Band Session Helper** 항목을 찾습니다.
2. **세부정보** 버튼을 클릭합니다.
3. **사이트 접근** 섹션에서 **모든 사이트에서** 또는 아래 두 사이트가 허용되어 있는지 확인합니다.
   - `band.us`
   - `abcpharm.net`
4. 허용되어 있지 않으면 **사이트 접근** 드롭다운을 클릭하여 **모든 사이트에서**를 선택합니다.

---

## 세션 저장 방법

Extension 설치 후 아래 순서로 세션을 저장합니다.

1. Chrome에서 [band.us](https://band.us)에 접속하여 로그인합니다.
2. 새 탭에서 [snsauto.abcpharm.net](https://snsauto.abcpharm.net)에 접속하여 로그인합니다.
3. Chrome 우측 상단 확장 프로그램 아이콘(퍼즐 모양)을 클릭합니다.
4. 목록에서 **Band Session Helper**를 클릭하여 팝업을 엽니다.
5. 팝업에서 **세션 저장하기** 버튼을 클릭합니다.
6. "세션 저장 완료" 메시지가 나타나면 성공입니다.

### 저장 성공 확인

소싱 앱에서도 세션 상태를 확인합니다.

1. 소싱 앱 → **설정** → **Band 세션** 탭으로 이동합니다.
2. 세션 상태가 **활성** (초록색)으로 표시되면 정상입니다.
3. 세션 만료 예상 일시가 함께 표시됩니다.

---

## 세션 갱신 주기

Band 세션은 약 **14일마다 만료**됩니다.

- 소싱 앱은 세션 만료 **3일 전**과 **1일 전**에 자동으로 알림을 발송합니다. ([알림 설정](../settings/notification.md) 참조)
- 알림을 받으면 위의 **세션 저장 방법**을 반복하여 세션을 갱신합니다.
- 세션이 만료된 상태에서는 자동 수집·발행이 모두 중단됩니다.

---

## 문제 해결

### Extension이 목록에 나타나지 않을 때

- 개발자 모드가 활성화되어 있는지 확인합니다.
- 폴더 선택 시 `band-session-extension` 폴더를 직접 선택했는지 확인합니다 (상위 폴더 선택 오류).
- `manifest.json` 파일이 폴더 내에 있는지 확인합니다.

### "세션 저장 실패" 메시지가 나올 때

- Band와 BandAuto 소싱 앱 양쪽에 모두 로그인되어 있는지 확인합니다.
- Extension의 사이트 접근 권한이 올바르게 설정되어 있는지 확인합니다.
- Chrome을 완전히 종료 후 재시작하고 다시 시도합니다.

### 세션 저장 후에도 상태가 "만료"로 표시될 때

- 소싱 앱 페이지를 새로고침(F5)합니다.
- 그래도 변경되지 않으면 소싱 앱 로그아웃 후 재로그인합니다.
