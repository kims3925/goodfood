import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 시드 데이터 생성 시작...')

  // 테스트 사용자 생성
  const hashedPassword = await bcryptjs.hash('test123!@#', 10)
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@bandauto.com' },
    update: {},
    create: {
      email: 'test@bandauto.com',
      password: hashedPassword,
      name: '테스트 사용자',
    }
  })

  console.log('✅ 테스트 사용자 생성 완료:', testUser.email)

  // 테스트 고객 데이터 생성
  const testCustomer = await prisma.customer.upsert({
    where: { phone: '010-1234-5678' },
    update: {},
    create: {
      name: '김테스트',
      phone: '010-1234-5678',
      email: 'customer@example.com',
      address: '서울시 강남구 테헤란로 123',
      memo: '테스트 고객'
    }
  })

  console.log('✅ 테스트 고객 생성 완료:', testCustomer.name)

  // 테스트 주문 먼저 삭제 (외래 키 제약 조건 때문)
  await prisma.order.deleteMany({
    where: {
      orderNumber: 'ORD-TEST-001'
    }
  })

  // 테스트 상품 삭제
  await prisma.product.deleteMany({
    where: {
      title: '테스트 상품 - 밴드 자동화 테스트용'
    }
  })

  // 테스트 상품 생성
  const testProduct = await prisma.product.create({
    data: {
      userId: testUser.id,
      title: '테스트 상품 - 밴드 자동화 테스트용',
      originalPrice: 10000,
      salePrice: 15000,
      description: '이것은 테스트용 상품입니다. 밴드 자동화 시스템을 테스트하기 위해 생성된 샘플 상품입니다. 🎯 주요 기능: 도매 밴드 연동, AI 컨텐츠 생성, 스룩페이 연동, 주문 관리 등을 모두 테스트할 수 있습니다.',
      status: 'ACTIVE'
    }
  })

  console.log('✅ 테스트 상품 생성 완료:', testProduct.title)

  // 테스트 주문 생성

  const testOrder = await prisma.order.create({
    data: {
      orderNumber: 'ORD-TEST-001',
      productId: testProduct.id,
      customerId: testCustomer.id,
      userId: testUser.id,
      quantity: 2,
      totalAmount: 30000,
      status: 'PENDING'
    }
  })

  console.log('✅ 테스트 주문 생성 완료:', testOrder.orderNumber)

  console.log('🎉 시드 데이터 생성 완료!')
  console.log('')
  console.log('📋 테스트 계정 정보:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📧 이메일: test@bandauto.com`)
  console.log(`🔑 비밀번호: test123!@#`)
  console.log(`👤 이름: 테스트 사용자`)
  console.log('')
  console.log('🌐 로그인 URL: http://localhost:3000/login')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ 시드 데이터 생성 실패:', e)
    await prisma.$disconnect()
    process.exit(1)
  })