/**
 * 서브도메인 기반 채널 시드 스크립트
 * 테스트용 소매 채널에 subdomain 설정
 */

import prisma from '@bandauto/db'

async function main() {
  console.log('서브도메인 기반 채널 시드 시작...')

  // 기존 소매 채널 조회
  const retailChannels = await prisma.channel.findMany({
    where: {
      kind: 'RETAIL',
    },
    orderBy: { id: 'asc' },
  })

  console.log(`기존 소매 채널 수: ${retailChannels.length}`)

  // 각 채널에 subdomain 설정
  for (let i = 0; i < retailChannels.length; i++) {
    const channel = retailChannels[i]
    const subdomain = `store-${channel.id}`

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        subdomain,
        displayName: channel.name,
        enableToss: true,
        enableBankTransfer: true,
        defaultShippingFee: 3000,
        freeShippingAmount: 50000,
      },
    })

    console.log(`채널 ${channel.id} (${channel.name}): subdomain = ${subdomain}`)
  }

  // 소매 채널이 없으면 테스트용 채널 생성
  if (retailChannels.length === 0) {
    console.log('소매 채널이 없어 테스트용 채널 생성...')

    // 먼저 사용자 확인
    const user = await prisma.user.findFirst({
      orderBy: { id: 'asc' },
    })

    if (!user) {
      console.log('사용자가 없습니다. 먼저 사용자를 생성해주세요.')
      return
    }

    const testChannels = [
      {
        name: '신선마트',
        subdomain: 'fresh-mart',
        displayName: '신선마트',
      },
      {
        name: '농수산직거래',
        subdomain: 'farm-direct',
        displayName: '농수산직거래',
      },
      {
        name: '오가닉마켓',
        subdomain: 'organic',
        displayName: '오가닉마켓',
      },
    ]

    for (const ch of testChannels) {
      const existingChannel = await prisma.channel.findFirst({
        where: { subdomain: ch.subdomain },
      })

      if (!existingChannel) {
        await prisma.channel.create({
          data: {
            userId: user.id,
            kind: 'RETAIL',
            platform: 'SHOP',
            channelKey: `shop_${ch.subdomain}`,
            name: ch.name,
            subdomain: ch.subdomain,
            displayName: ch.displayName,
            isActive: true,
            enableToss: true,
            enableBankTransfer: true,
            defaultShippingFee: 3000,
            freeShippingAmount: 50000,
            bankName: '신한은행',
            bankAccount: '110-123-456789',
            accountHolder: '테스트상점',
          },
        })
        console.log(`테스트 채널 생성: ${ch.name} (${ch.subdomain})`)
      } else {
        console.log(`이미 존재: ${ch.subdomain}`)
      }
    }
  }

  console.log('\n서브도메인 기반 채널 시드 완료!')
  console.log('\n테스트 방법:')
  console.log('1. http://fresh-mart.lvh.me:3000')
  console.log('2. http://localhost:3000?channel=fresh-mart')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
