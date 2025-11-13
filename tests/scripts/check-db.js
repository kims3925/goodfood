const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    const totalPosts = await prisma.collectedPost.count()
    console.log('Total collected posts:', totalPosts)
    
    const recentPosts = await prisma.collectedPost.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        wholesaleBand: {
          select: {
            name: true
          }
        }
      }
    })
    
    console.log('\nRecent posts:')
    recentPosts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title} - ${post.status} - ${post.wholesaleBand.name} - ${post.createdAt}`)
    })
    
    const totalBands = await prisma.wholesaleBand.count()
    console.log(`\nTotal wholesale bands: ${totalBands}`)
    
  } catch (error) {
    console.error('Database error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()