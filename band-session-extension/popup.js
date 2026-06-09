
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
const accountConfirm = document.getElementById('accountConfirm');
const expectedAccount = document.getElementById('expectedAccount');
const accountCheckbox = document.getElementById('accountCheckbox');

// 서버에 설정된 밴드 로그인 계정 (null = 미설정, 검증 생략)
let expectedEmail = null;
// 서버 URL은 config.js에서 로드됨 (SERVER_URL)
if (typeof SERVER_URL === 'undefined') {
  console.error('config.js가 로드되지 않았거나 SERVER_URL이 정의되지 않았습니다.');
  hideAllStates();
  errorState.classList.remove('hidden');
  errorDesc.textContent = '설정 파일을 찾을 수 없습니다. 확장 프로그램을 다시 설치해주세요.';
}
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
  // 쿠키 이름 우선순위: auth-token-manager > auth-token-admin > auth-token (레거시)
  const authCookie = cookies.find(c => c.name === 'auth-token-manager')
    || cookies.find(c => c.name === 'auth-token-admin')
    || cookies.find(c => c.name === 'auth-token');
  return authCookie ? authCookie.value : null;
}

// Band 로그인 상태 확인
async function checkBandLoginStatus() {
  const bandCookies = await chrome.cookies.getAll({ domain: '.band.us' });
  const hasBandSession = bandCookies.some(c => c.name === 'band_session');
  return hasBandSession;
}

// 서버에 설정된 밴드 로그인 계정 조회 (미설정/조회실패 시 null = 검증 생략)
async function fetchExpectedBandAccount(authToken) {
  try {
    const response = await fetch(`${SERVER_URL}/api/settings/band-account`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.success ? (result.data.bandLoginEmail || null) : null;
  } catch (error) {
    console.warn('밴드 로그인 계정 설정 조회 실패 (검증 생략):', error.message);
    return null;
  }
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

    // 3. 설정된 밴드 로그인 계정 확인 (설정 시 체크박스 확인 전까지 저장 비활성)
    expectedEmail = await fetchExpectedBandAccount(authToken);
    if (expectedEmail) {
      expectedAccount.textContent = expectedEmail;
      accountConfirm.classList.remove('hidden');
      accountCheckbox.checked = false;
      saveBtn.disabled = true;
    } else {
      accountConfirm.classList.add('hidden');
      saveBtn.disabled = false;
    }

    // 4. 모두 준비됨
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

    // 서버로 전송 (bandAccountEmail: 서버 설정값을 그대로 회신 — 사용자가 체크박스로 확인)
    const response = await fetch(`${SERVER_URL}/api/band-session/save-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        cookieString: JSON.stringify(bandCookies),
        bandAccountEmail: expectedEmail || undefined
      })
    });

    const result = await response.json();

    if (result.success) {
      // 확인된 계정을 저장 — background 자동저장이 같은 값을 회신할 수 있도록
      await chrome.storage.local.set({ confirmedBandAccountEmail: expectedEmail || null });
      hideAllStates();
      hideAllButtons();
      accountConfirm.classList.add('hidden');
      saveComplete.classList.remove('hidden');
      saveResultDesc.textContent = `${result.data.updatedCount ?? result.data.channelCount}개 채널에 세션이 저장되었습니다`;
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
    // 계정 확인이 필요한 경우 체크 상태를 유지한 채 버튼 상태 복원
    saveBtn.disabled = expectedEmail ? !accountCheckbox.checked : false;
    saveBtnText.textContent = '세션 저장하기';
    saveSpinner.classList.add('hidden');
  }
}

// 이벤트 리스너
saveBtn.addEventListener('click', saveSession);

// 계정 확인 체크박스 — 체크 전까지 저장 버튼 비활성
accountCheckbox.addEventListener('change', () => {
  saveBtn.disabled = !accountCheckbox.checked;
});

openBandBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://band.us/home' });
});

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: SERVER_URL });
});

retryBtn.addEventListener('click', checkStatus);

// 초기 상태 확인
checkStatus();
