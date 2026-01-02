/**
 * Band Session Helper - 공통 설정
 */

// 개발용
const SERVER_URL = 'http://localhost:3001';
const APP_DOMAIN = 'localhost';

// // 프로덕션용
// const SERVER_URL = 'https://snsauto.abcpharm.net';
// const APP_DOMAIN = 'snsauto.abcpharm.net';

// 자동 저장 간격 (밀리초) - 1시간
const AUTO_SAVE_INTERVAL = 60 * 60 * 1000;
if (typeof SERVER_URL === 'undefined') {
  console.error('config.js가 로드되지 않았거나 SERVER_URL이 정의되지 않았습니다.');
  hideAllStates();
  errorState.classList.remove('hidden');
  errorDesc.textContent = '설정 파일을 찾을 수 없습니다. 확장 프로그램을 다시 설치해주세요.';
}