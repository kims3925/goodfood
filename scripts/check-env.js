// 환경변수 확인 스크립트
require('dotenv').config({ path: '.env.local' })

console.log('📋 환경변수 확인 (민감한 정보는 일부만 표시)\n')

const envVars = {
  'DATABASE_URL': process.env.DATABASE_URL,
  'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
  'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET ? '✅ 설정됨' : '❌ 없음',
  'GOOGLE_AI_API_KEY': process.env.GOOGLE_AI_API_KEY ? '✅ 설정됨' : '❌ 없음',
  'BAND_CLIENT_ID': process.env.BAND_CLIENT_ID ? '✅ 설정됨' : '❌ 없음',
  'TOSS_PAYMENTS_CLIENT_KEY': process.env.TOSS_PAYMENTS_CLIENT_KEY ? '✅ 설정됨' : '❌ 없음',
  'FREE_SHIPPING_AMOUNT': process.env.FREE_SHIPPING_AMOUNT,
  'DEFAULT_SHIPPING_FEE': process.env.DEFAULT_SHIPPING_FEE,
}

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`${key}: ${value}`)
})
