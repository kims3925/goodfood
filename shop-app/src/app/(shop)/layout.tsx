import { headers } from 'next/headers'
import StoreLayout from './StoreLayout'
import { ChannelProvider, ChannelInfo, RelatedChannel } from '@/contexts/ChannelContext'
import prisma from '@bandauto/db'
import { ChannelKind } from '@bandauto/db'

// 같은 유저의 다른 채널들 조회
async function getRelatedChannels(currentChannelId: number, userId: number | null): Promise<RelatedChannel[]> {
  if (!userId) return []

  try {
    const channels = await prisma.channel.findMany({
      where: {
        userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
        id: { not: currentChannelId }, // 현재 채널 제외
        NOT: { subdomain: null }, // subdomain이 null이 아닌 채널만
      },
      select: {
        id: true,
        subdomain: true,
        name: true,
        displayName: true,
        theme: {
          select: {
            logoUrl: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return channels.map((ch) => ({
      id: ch.id,
      subdomain: ch.subdomain!,
      name: ch.name,
      displayName: ch.displayName || undefined,
      logoUrl: ch.theme?.logoUrl || undefined,
    }))
  } catch (error) {
    console.error('Failed to get related channels:', error)
    return []
  }
}

// 채널 정보 조회
async function getChannelFromHeaders(): Promise<ChannelInfo | null> {
  const headersList = await headers()
  const channelId = headersList.get('x-channel-id')

  if (!channelId) return null

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: parseInt(channelId) },
      select: {
        id: true,
        userId: true,
        subdomain: true,
        name: true,
        displayName: true,
        coverUrl: true,
        enableToss: true,
        enableBankTransfer: true,
        freeShippingAmount: true,
        defaultShippingFee: true,
        contactPhone: true,
        contactEmail: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
        theme: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            logoUrl: true,
            faviconUrl: true,
            bannerUrl: true,
            footerText: true,
          },
        },
      },
    })

    if (!channel || !channel.subdomain) return null

    return {
      id: channel.id,
      subdomain: channel.subdomain,
      name: channel.name,
      displayName: channel.displayName || undefined,
      coverUrl: channel.coverUrl || undefined,
      enableToss: channel.enableToss,
      enableBankTransfer: channel.enableBankTransfer,
      freeShippingAmount: channel.freeShippingAmount || undefined,
      defaultShippingFee: channel.defaultShippingFee || undefined,
      contactPhone: channel.contactPhone || undefined,
      contactEmail: channel.contactEmail || undefined,
      bankInfo: channel.bankName
        ? {
            bankName: channel.bankName,
            bankAccount: channel.bankAccount!,
            accountHolder: channel.accountHolder!,
          }
        : undefined,
      theme: channel.theme
        ? {
            primaryColor: channel.theme.primaryColor || undefined,
            secondaryColor: channel.theme.secondaryColor || undefined,
            logoUrl: channel.theme.logoUrl || undefined,
            faviconUrl: channel.theme.faviconUrl || undefined,
            bannerUrl: channel.theme.bannerUrl || undefined,
            footerText: channel.theme.footerText || undefined,
          }
        : undefined,
      relatedChannels: await getRelatedChannels(channel.id, channel.userId),
    }
  } catch (error) {
    console.error('Failed to get channel from headers:', error)
    return null
  }
}

// 동적 메타데이터 생성
export async function generateMetadata() {
  const channel = await getChannelFromHeaders()

  const title = channel
    ? `${channel.displayName || channel.name} - 신선한 농수산물 직거래 쇼핑몰`
    : 'ABC마켓 - 신선한 농수산물 직거래 쇼핑몰'

  return {
    title,
    description: '신선한 농수산물을 합리적인 가격에 만나보세요!',
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const channel = await getChannelFromHeaders()

  return (
    <ChannelProvider initialChannel={channel}>
      <StoreLayout>{children}</StoreLayout>
    </ChannelProvider>
  )
}
