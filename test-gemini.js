// Gemini API 테스트 스크립트
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  console.log('=== Gemini API 테스트 ===');
  console.log('API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '없음');

  if (!apiKey || apiKey === '여기에-새로운-API-키를-입력하세요') {
    console.error('❌ API 키가 설정되지 않았습니다!');
    console.log('\n해결 방법:');
    console.log('1. https://aistudio.google.com/app/apikey 방문');
    console.log('2. 새 API 키 생성');
    console.log('3. .env.local 파일의 GOOGLE_AI_API_KEY 업데이트');
    process.exit(1);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // 최신 Gemini 모델 사용
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    console.log('\n✅ API 연결 성공!');
    console.log('사용 모델: gemini-1.5-flash');
    console.log('테스트 요청 전송 중...\n');

    const result = await model.generateContent('안녕하세요를 영어로 번역해주세요.');
    const response = await result.response;
    const text = response.text();

    console.log('✅ 테스트 성공!');
    console.log('응답:', text);

  } catch (error) {
    console.error('\n❌ API 오류:', error.message);

    if (error.message.includes('quota')) {
      console.log('\n💡 할당량 초과 오류 해결 방법:');
      console.log('1. 새 Google 계정으로 새 API 키 발급');
      console.log('2. https://ai.dev/usage?tab=rate-limit 에서 사용량 확인');
      console.log('3. 유료 플랜으로 업그레이드 고려');
    } else if (error.message.includes('API key')) {
      console.log('\n💡 API 키 오류 해결 방법:');
      console.log('1. https://aistudio.google.com/app/apikey 에서 키 재발급');
      console.log('2. API 키가 올바르게 복사되었는지 확인');
      console.log('3. 프로젝트에서 Gemini API가 활성화되어 있는지 확인');
    }
  }
}

testGeminiAPI();
