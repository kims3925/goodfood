/**
 * 테스트 DB 설정 스크립트
 * Windows 환경에서도 안전하게 테스트 DB를 생성합니다
 */

const { execSync } = require('child_process');
const path = require('path');

// 환경변수 설정
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';

console.log('🔧 테스트 DB 설정 중...');
console.log(`📁 DATABASE_URL: ${process.env.DATABASE_URL}`);

try {
  // Prisma DB Push
  console.log('\n1️⃣ Prisma 스키마 동기화...');
  execSync('npx prisma db push', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db'
    }
  });

  console.log('\n✅ 테스트 DB 설정 완료!');
  console.log('📂 파일 위치: prisma/test.db');
} catch (error) {
  console.error('\n❌ 테스트 DB 설정 실패:', error.message);
  process.exit(1);
}
