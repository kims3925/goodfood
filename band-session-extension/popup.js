// 서버 URL
const SERVER_URL = 'http://snsauto.abcpharm.net:3001';
const APP_DOMAIN = 'snsauto.abcpharm.net';

// DOM 요소
const loadingState = document.getElementById('loadingState');
const needBandLogin = document.getElementById('needBandLogin');
const needAppLogin = document.getElementById('needAppLogin');
const readyToSave = document.getElementById('readyToSave');
const saveComplete = document.getElementById('saveComplete');
const errorState = document.getElementById('errorState');
const errorDesc = document.getElementById('errorDesc');
const saveResultDesc = document.getElementById('saveResultDesc');

const saveBtn = document.getElementById('saveBtn');
const saveBtnText = document.getElementById('saveBtnText');
const saveSpinner = document.getElementById('saveSpinner');
const openBandBtn = document.getElementById('openBandBtn');
const openAppBtn = document.getElementById('openAppBtn');
const retryBtn = document.getElementById('retryBtn');

// 모든 상태 카드 숨기기
function hideAllStates() {
  loadingState.classList.add('hidden');
  needBandLogin.classList.add('hidden');
  needAppLogin.classList.add('hidden');
  readyToSave.classList.add('hidden');
  saveComplete.classList.add('hidden');
  errorState.classList.add('hidden');
}

// 모든 버튼 숨기기
function hideAllButtons() {
  saveBtn.classList.add('hidden');
  openBandBtn.classList.add('hidden');
  openAppBtn.classList.add('hidden');
  retryBtn.classList.add('hidden');
}

// Band 쿠키 가져오기
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

// Sourcing App 인증 토큰 가져오기
async function getAuthToken() {
  // URL 기반으로 쿠키 조회 (도메인 매칭 문제 해결)
  const cookies = await chrome.cookies.getAll({ url: SERVER_URL });
  console.log('Cookies for SERVER_URL:', cookies.map(c => c.name));
  const authCookie = cookies.find(c => c.name === 'auth-token');
  return authCookie ? authCookie.value : null;
}

// Band 로그인 상태 확인
async function checkBandLoginStatus() {
  const bandCookies = await chrome.cookies.getAll({ domain: '.band.us' });
  const hasBandSession = bandCookies.some(c => c.name === 'band_session');
  return hasBandSession;
}

// 상태 확인 및 UI 업데이트
async function checkStatus() {
  hideAllStates();
  hideAllButtons();
  loadingState.classList.remove('hidden');

  try {
    // 1. Sourcing App 로그인 확인
    const authToken = await getAuthToken();
    if (!authToken) {
      hideAllStates();
      needAppLogin.classList.remove('hidden');
      openAppBtn.classList.remove('hidden');
      retryBtn.classList.remove('hidden');
      return;
    }

    // 2. Band 로그인 확인
    const isBandLoggedIn = await checkBandLoginStatus();
    if (!isBandLoggedIn) {
      hideAllStates();
      needBandLogin.classList.remove('hidden');
      openBandBtn.classList.remove('hidden');
      retryBtn.classList.remove('hidden');
      return;
    }

    // 3. 모두 준비됨
    hideAllStates();
    readyToSave.classList.remove('hidden');
    saveBtn.classList.remove('hidden');

  } catch (error) {
    console.error('Status check error:', error);
    hideAllStates();
    errorState.classList.remove('hidden');
    errorDesc.textContent = error.message;
    retryBtn.classList.remove('hidden');
  }
}

// 세션 저장
async function saveSession() {
  saveBtn.disabled = true;
  saveBtnText.textContent = '저장 중...';
  saveSpinner.classList.remove('hidden');

  try {
    // 쿠키 수집
    const bandCookies = await getBandCookies();
    const authToken = await getAuthToken();

    if (!authToken) {
      throw new Error('인증 토큰이 없습니다. Sourcing App에 다시 로그인해주세요.');
    }

    if (bandCookies.length === 0) {
      throw new Error('Band 쿠키를 찾을 수 없습니다.');
    }

    // 서버로 전송
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
      hideAllStates();
      hideAllButtons();
      saveComplete.classList.remove('hidden');
      saveResultDesc.textContent = `${result.data.channelCount}개 채널에 세션이 저장되었습니다`;
    } else {
      throw new Error(result.error || '저장에 실패했습니다');
    }

  } catch (error) {
    console.error('Save error:', error);
    hideAllStates();
    errorState.classList.remove('hidden');
    errorDesc.textContent = error.message;
    retryBtn.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtnText.textContent = '세션 저장하기';
    saveSpinner.classList.add('hidden');
  }
}

// 이벤트 리스너
saveBtn.addEventListener('click', saveSession);

openBandBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://band.us/home' });
});

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: SERVER_URL });
});

retryBtn.addEventListener('click', checkStatus);

// 초기 상태 확인
checkStatus();
