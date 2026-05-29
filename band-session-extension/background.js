/**
 * Band Session Helper - Background Service Worker
 * Band 페이지 방문 시 자동으로 세션 저장
 */

// =============================================
// 설정 import (에러 처리 포함)
// =============================================

try {
  importScripts('config.js');
} catch (error) {
  console.error('[Band Session] config.js 로드 실패:', error.message);
  console.error('[Band Session] 확장 프로그램을 다시 설치해주세요.');
  throw new Error('config.js 로드 실패 - Service Worker 종료');
}

// 필수 설정 변수 검증
if (typeof SERVER_URL === 'undefined' || !SERVER_URL) {
  console.error('[Band Session] SERVER_URL이 정의되지 않았습니다.');
  console.error('[Band Session] Service Worker를 종료합니다.');
  self.close();
  throw new Error('SERVER_URL 미정의 - Service Worker 종료');
}

if (typeof AUTO_SAVE_INTERVAL === 'undefined' || !AUTO_SAVE_INTERVAL) {
  console.error('[Band Session] AUTO_SAVE_INTERVAL이 정의되지 않았습니다.');
  console.error('[Band Session] Service Worker를 종료합니다.');
  self.close();
  throw new Error('AUTO_SAVE_INTERVAL 미정의 - Service Worker 종료');
}

console.log('[Band Session] config.js 로드 완료 - SERVER_URL:', SERVER_URL);

// =============================================
// 상태 관리
// =============================================

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
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
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
 * 쿠키명 우선순위: auth-token-manager > auth-token-admin > auth-token (레거시)
 */
async function getAuthToken() {
  const cookies = await chrome.cookies.getAll({ url: SERVER_URL });
  console.log('[Band Session] 서버 쿠키 목록:', cookies.map(c => c.name));
  const authCookie = cookies.find(c => c.name === 'auth-token-manager')
    || cookies.find(c => c.name === 'auth-token-admin')
    || cookies.find(c => c.name === 'auth-token');
  return authCookie ? authCookie.value : null;
}

/**
 * Band 로그인 상태 확인
 */
async function checkBandLoginStatus() {
  const bandCookies = await chrome.cookies.getAll({ domain: '.band.us' });
  return bandCookies.some(c => c.name === 'band_session');
}

// =============================================
// 세션 저장 핵심 로직 (공통 헬퍼)
// =============================================

/**
 * 세션 저장 수행 (공통 로직)
 * 검증 또는 네트워크 에러 시 throw
 * @returns {Promise<{channelCount: number}>} 서버 응답 데이터
 * @throws {Error} 검증 실패 또는 네트워크 에러
 */
async function performSessionSave() {
  // 1. Sourcing App 로그인 확인
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error('Sourcing App에 로그인해주세요.');
  }

  // 2. Band 로그인 확인
  const isBandLoggedIn = await checkBandLoginStatus();
  if (!isBandLoggedIn) {
    throw new Error('Band에 로그인해주세요.');
  }

  // 3. 쿠키 수집
  const bandCookies = await getBandCookies();
  if (bandCookies.length === 0) {
    throw new Error('Band 쿠키를 찾을 수 없습니다.');
  }

  // 4. 서버로 전송 (타임아웃 포함)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

  try {
    const response = await fetch(`${SERVER_URL}/api/band-session/save-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        cookieString: JSON.stringify(bandCookies)
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 응답 상태 확인 - 실패 시 본문 로그
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = '(응답 본문 읽기 실패)';
      }
      console.error(`[Band Session] 서버 에러 응답 (${response.status}):`, errorBody.substring(0, 500));
      throw new Error(`서버 응답 에러: ${response.status} ${response.statusText}`);
    }

    // JSON 파싱 (실패 시 상세 로그)
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('[Band Session] JSON 파싱 실패:', parseError.message);
      throw new Error('서버 응답을 파싱할 수 없습니다.');
    }

    if (!result.success) {
      throw new Error(result.error || '서버에서 저장 실패');
    }

    return result.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('서버 요청 시간 초과 (30초)');
    }
    throw error;
  }
}

// =============================================
// 자동 저장
// =============================================

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
    console.log('[Band Session] 자동 저장 시작...');
    const data = await performSessionSave();

    // 성공 시 상태 업데이트
    lastAutoSaveTime = now;
    await chrome.storage.local.set({ lastAutoSaveTime: now });
    console.log(`[Band Session] 자동 저장 완료: ${data.channelCount}개 채널`);

  } catch (error) {
    // 검증 실패는 스킵으로 처리 (로그인 안됨 등)
    if (error.message.includes('로그인') || error.message.includes('쿠키')) {
      console.log(`[Band Session] 자동 저장 스킵: ${error.message}`);
    } else {
      console.error('[Band Session] 자동 저장 에러:', error.message);
    }
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
      // Service Worker가 중지될 수 있으므로 chrome.alarms 사용
      chrome.alarms.create('autoSaveSession', { delayInMinutes: 2 / 60 }); // 2초
    }
  }
});

/**
 * Alarm 이벤트 리스너 (Service Worker 안정성을 위해 setTimeout 대신 사용)
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoSaveSession') {
    console.log('[Band Session] Alarm 트리거: autoSaveSession');
    autoSaveSession();
  }
  if (alarm.name === 'periodicSave') {
    console.log('[Band Session] Alarm 트리거: periodicSave (1시간 주기)');
    autoSaveSession();
  }
});

/**
 * 확장 프로그램 시작 시 마지막 저장 시간 복원 + 주기 알람 등록
 */
chrome.storage.local.get(['lastAutoSaveTime'], (result) => {
  if (result.lastAutoSaveTime) {
    lastAutoSaveTime = result.lastAutoSaveTime;
    console.log('[Band Session] 마지막 저장 시간 복원:', new Date(lastAutoSaveTime).toLocaleString());
  }
});

// 1시간마다 자동 저장 알람 등록 (Chrome 재시작 시에도 유지)
chrome.alarms.create('periodicSave', { periodInMinutes: 60 });
console.log('[Band Session] 주기 알람 등록: 1시간마다 자동 저장');

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
        console.log('[Band Session] 웹 앱 요청으로 세션 저장 시작...');
        const data = await performSessionSave();

        // 성공 시 상태 업데이트
        lastAutoSaveTime = Date.now();
        await chrome.storage.local.set({ lastAutoSaveTime });
        console.log(`[Band Session] 웹 앱 요청 저장 완료: ${data.channelCount}개 채널`);

        sendResponse({
          success: true,
          data: {
            channelCount: data.channelCount,
            savedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[Band Session] 웹 앱 요청 저장 에러:', error.message);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }

  // debugCookies: 서버 쿠키 디버그 (개발용)
  if (request.action === 'debugCookies') {
    (async () => {
      try {
        const cookies = await chrome.cookies.getAll({ url: SERVER_URL });
        sendResponse({
          success: true,
          data: {
            serverUrl: SERVER_URL,
            cookieCount: cookies.length,
            cookieNames: cookies.map(c => c.name),
            cookies: cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure }))
          }
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 알 수 없는 액션
  sendResponse({ success: false, error: '알 수 없는 요청입니다.' });
  return true;
});

console.log('[Band Session] Background service worker 시작됨');
