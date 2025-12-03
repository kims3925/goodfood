import { PrismaClient } from '@bandauto/db'
const prisma = new PrismaClient()

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } })
  console.log('=== Users ===')
  console.log(JSON.stringify(users, null, 2))

  const channels = await prisma.channel.findMany({
    where: { kind: 'RETAIL' },
    select: { id: true, name: true, userId: true, platform: true }
  })
  console.log('\n=== Retail Channels ===')
  console.log(JSON.stringify(channels, null, 2))

  const orders = await prisma.order.findMany({
    take: 5,
    include: {
      items: {
        include: {
          publishedProduct: {
            select: { channelId: true }
          }
        }
      }
    }
  })
  console.log('\n=== Orders (first 5) ===')
  orders.forEach(o => {
    console.log(`Order ${o.orderNumber}: userId=${o.userId}, status=${o.status}`)
    o.items.forEach(i => {
      console.log(`  - Item: channelId=${i.publishedProduct?.channelId}`)
    })
  })

  await prisma.$disconnect()
}

check().catch(console.error)
