// 사용 가능한 Gemini 모델 목록 확인
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  console.log('=== Gemini 사용 가능한 모델 목록 ===\n');

  if (!apiKey) {
    console.error('❌ API 키가 설정되지 않았습니다!');
    process.exit(1);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // 간단한 테스트로 사용 가능한 모델 확인
    const models = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'models/gemini-pro',
      'models/gemini-1.5-pro',
      'models/gemini-1.5-flash'
    ];

    console.log('테스트 중인 모델들:\n');

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Hi');
        await result.response;
        console.log(`✅ ${modelName} - 작동함`);
      } catch (error) {
        console.log(`❌ ${modelName} - ${error.message.split('\n')[0]}`);
      }
    }

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
  }
}

listModels();
