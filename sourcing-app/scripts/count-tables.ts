import { PrismaClient } from '@bandauto/db'
const prisma = new PrismaClient()

async function check() {
  console.log('=== 테이블별 데이터 수 ===')
  console.log('User:', await prisma.user.count())
  console.log('Channel:', await prisma.channel.count())
  console.log('Product:', await prisma.product.count())
  console.log('CollectedProduct:', await prisma.collectedProduct.count())
  console.log('CollectedPost:', await prisma.collectedPost.count())
  console.log('PublishedProduct:', await prisma.publishedProduct.count())
  console.log('Order:', await prisma.order.count())
  console.log('OrderItem:', await prisma.orderItem.count())
  await prisma.$disconnect()
}
check()
