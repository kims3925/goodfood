import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function check() {
  // 사용자 확인
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true } })
  console.log('사용자:')
  users.forEach(u => console.log('  -', u.id, u.name, '(' + u.role + ')'))

  // 소매밴드 확인
  const bands = await prisma.retailBand.findMany({
    include: { apiConfig: { select: { platform: true } } }
  })
  console.log('\n소매밴드:', bands.length, '개')
  bands.forEach(b => console.log('  -', b.id, b.name, '(userId:', b.userId, ', platform:', (b.apiConfig?.platform || 'N/A') + ')'))

  // ProductPublish 확인
  const publishes = await prisma.productPublish.findMany({
    include: { product: { select: { name: true } }, retailBand: { select: { name: true } } }
  })
  console.log('\nProductPublish:', publishes.length, '개')
  publishes.forEach(p => console.log('  -', p.status, '(userId:', p.userId + ')', p.product?.name?.slice(0,30), '->', p.retailBand?.name))

  // Product 확인
  const products = await prisma.product.count()
  console.log('\n상품 수:', products, '개')
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
