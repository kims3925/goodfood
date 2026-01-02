/**
 * Band Session Helper - Background Service Worker
 * Band 페이지 방문 시 자동으로 세션 저장
 */

// 설정 import
importScripts('config.js');

// 마지막 자동 저장 시간
let lastAutoSaveTime = 0;

/**
 * Band 쿠키 가져오기
 */
async function getBandCookies() {
  const bandCookies = await chrome.cookies.getAll({ domain: '.band.us' });
  const naverCookies = await chrome.cookies.getAll({ domain: '.naver.com' });

  const formatCookie = (cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    expires: cookie.expirationDate || -1,
    httpOnly: cookie.httpOnly || false,
    secure: cookie.secure || true,
    sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
              cookie.sameSite === 'lax' ? 'Lax' :
              cookie.sameSite === 'strict' ? 'Strict' : 'Lax'
  });

  return [
    ...bandCookies.map(formatCookie),
    ...naverCookies.map(formatCookie)
  ];
}

/**
 * Sourcing App 인증 토큰 가져오기
 */
async function getAuthToken() {
  const cookies = await chrome.cookies.getAll({ url: SERVER_URL });
  const authCookie = cookies.find(c => c.name === 'auth-token');
  return authCookie ? authCookie.value : null;
}

/**
 * Band 로그인 상태 확인
 */
async function checkBandLoginStatus() {
  const bandCookies = await chrome.cookies.getAll({ domain: '.band.us' });
  return bandCookies.some(c => c.name === 'band_session');
}

/**
 * 세션 자동 저장
 */
async function autoSaveSession() {
  const now = Date.now();

  // 마지막 저장 후 1시간 이내면 스킵
  if (now - lastAutoSaveTime < AUTO_SAVE_INTERVAL) {
    console.log('[Band Session] 자동 저장 스킵 (1시간 이내 저장됨)');
    return;
  }

  try {
    // 1. Sourcing App 로그인 확인
    const authToken = await getAuthToken();
    if (!authToken) {
      console.log('[Band Session] 자동 저장 스킵 (Sourcing App 미로그인)');
      return;
    }

    // 2. Band 로그인 확인
    const isBandLoggedIn = await checkBandLoginStatus();
    if (!isBandLoggedIn) {
      console.log('[Band Session] 자동 저장 스킵 (Band 미로그인)');
      return;
    }

    // 3. 쿠키 수집
    const bandCookies = await getBandCookies();
    if (bandCookies.length === 0) {
      console.log('[Band Session] 자동 저장 스킵 (쿠키 없음)');
      return;
    }

    // 4. 서버로 전송
    console.log('[Band Session] 자동 저장 시작...');
    const response = await fetch(`${SERVER_URL}/api/band-session/save-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        cookieString: JSON.stringify(bandCookies)
      })
    });

    const result = await response.json();

    if (result.success) {
      lastAutoSaveTime = now;
      console.log(`[Band Session] 자동 저장 완료: ${result.data.channelCount}개 채널`);

      // 저장 시간 기록 (브라우저 재시작 시에도 유지)
      chrome.storage.local.set({ lastAutoSaveTime: now });
    } else {
      console.error('[Band Session] 자동 저장 실패:', result.error);
    }

  } catch (error) {
    console.error('[Band Session] 자동 저장 에러:', error);
  }
}

/**
 * Band 페이지 방문 감지
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 페이지 로드 완료 시
  if (changeInfo.status === 'complete' && tab.url) {
    // Band 페이지인지 확인
    if (tab.url.includes('band.us')) {
      console.log('[Band Session] Band 페이지 감지:', tab.url);
      // 약간의 딜레이 후 자동 저장 시도 (쿠키 설정 완료 대기)
      setTimeout(autoSaveSession, 2000);
    }
  }
});

/**
 * 확장 프로그램 시작 시 마지막 저장 시간 복원
 */
chrome.storage.local.get(['lastAutoSaveTime'], (result) => {
  if (result.lastAutoSaveTime) {
    lastAutoSaveTime = result.lastAutoSaveTime;
    console.log('[Band Session] 마지막 저장 시간 복원:', new Date(lastAutoSaveTime).toLocaleString());
  }
});

/**
 * 웹 앱에서 보낸 메시지 처리 (externally_connectable)
 */
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[Band Session] 외부 메시지 수신:', request);

  // ping: Extension 설치 확인
  if (request.action === 'ping') {
    sendResponse({ success: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  // getStatus: 현재 상태 확인
  if (request.action === 'getStatus') {
    (async () => {
      try {
        const isBandLoggedIn = await checkBandLoginStatus();
        const authToken = await getAuthToken();
        sendResponse({
          success: true,
          data: {
            bandLoggedIn: isBandLoggedIn,
            appLoggedIn: !!authToken,
            lastSaveTime: lastAutoSaveTime || null
          }
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }

  // saveSession: 세션 저장 요청
  if (request.action === 'saveSession') {
    (async () => {
      try {
        // 1. Sourcing App 로그인 확인
        const authToken = await getAuthToken();
        if (!authToken) {
          sendResponse({ success: false, error: 'Sourcing App에 로그인해주세요.' });
          return;
        }

        // 2. Band 로그인 확인
        const isBandLoggedIn = await checkBandLoginStatus();
        if (!isBandLoggedIn) {
          sendResponse({ success: false, error: 'Band에 로그인해주세요.' });
          return;
        }

        // 3. 쿠키 수집
        const bandCookies = await getBandCookies();
        if (bandCookies.length === 0) {
          sendResponse({ success: false, error: 'Band 쿠키를 찾을 수 없습니다.' });
          return;
        }

        // 4. 서버로 전송
        console.log('[Band Session] 웹 앱 요청으로 세션 저장 시작...');
        const response = await fetch(`${SERVER_URL}/api/band-session/save-all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            cookieString: JSON.stringify(bandCookies)
          })
        });

        const result = await response.json();

        if (result.success) {
          lastAutoSaveTime = Date.now();
          chrome.storage.local.set({ lastAutoSaveTime });
          console.log(`[Band Session] 웹 앱 요청 저장 완료: ${result.data.channelCount}개 채널`);
          sendResponse({
            success: true,
            data: {
              channelCount: result.data.channelCount,
              savedAt: new Date().toISOString()
            }
          });
        } else {
          sendResponse({ success: false, error: result.error });
        }

      } catch (error) {
        console.error('[Band Session] 웹 앱 요청 저장 에러:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }

  // 알 수 없는 액션
  sendResponse({ success: false, error: '알 수 없는 요청입니다.' });
  return true;
});

console.log('[Band Session] Background service worker 시작됨');
