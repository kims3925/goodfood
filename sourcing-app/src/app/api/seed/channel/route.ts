import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// POST: 다양한 플랫폼의 채널 시드 데이터 생성
export async function POST() {
  try {
    const userId = 1

    // 기존 채널 삭제
    await prisma.channel.deleteMany({ where: { userId } })

    // 다양한 플랫폼의 채널 데이터
    const channels = [
      // BAND 도매 채널
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'BAND' as const,
        channelKey: 'AAAbOcRgPVXrYAB_band001',
        name: '도매도깨비마켓',
        coverUrl: 'https://placehold.co/100x100/4A90D9/ffffff?text=BAND',
        isActive: true,
        accountHolder: '김도매',
        bankAccount: '110-1234-5678',
        bankName: '신한은행',
      },
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'BAND' as const,
        channelKey: 'AAAbOcRgPVXrYAB_band002',
        name: '전국도매연합',
        coverUrl: 'https://placehold.co/100x100/4A90D9/ffffff?text=BAND',
        isActive: true,
        accountHolder: '이도매',
        bankAccount: '3333-04-1234567',
        bankName: '국민은행',
      },
      // 네이버 카페 도매 채널
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'NAVER_CAFE' as const,
        channelKey: 'naver_cafe_wholesale_001',
        name: '패션도매카페',
        coverUrl: 'https://placehold.co/100x100/03C75A/ffffff?text=NAVER',
        isActive: true,
        accountHolder: '박네이버',
        bankAccount: '1002-123-456789',
        bankName: '우리은행',
      },
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'NAVER_CAFE' as const,
        channelKey: 'naver_cafe_wholesale_002',
        name: '동대문도매정보',
        coverUrl: 'https://placehold.co/100x100/03C75A/ffffff?text=NAVER',
        isActive: true,
        accountHolder: '최카페',
        bankAccount: '123-45-678901',
        bankName: '하나은행',
      },
      // 알리익스프레스 도매 채널
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'ALIEXPRESS' as const,
        channelKey: 'aliexpress_store_001',
        name: '알리 패션스토어',
        coverUrl: 'https://placehold.co/100x100/FF6A00/ffffff?text=ALI',
        isActive: true,
        accountHolder: null,
        bankAccount: null,
        bankName: null,
      },
      {
        userId,
        kind: 'WHOLESALE' as const,
        platform: 'ALIEXPRESS' as const,
        channelKey: 'aliexpress_store_002',
        name: '알리 잡화천국',
        coverUrl: 'https://placehold.co/100x100/FF6A00/ffffff?text=ALI',
        isActive: true,
        accountHolder: null,
        bankAccount: null,
        bankName: null,
      },
      // BAND 소매 채널
      {
        userId,
        kind: 'RETAIL' as const,
        platform: 'BAND' as const,
        channelKey: 'AAAbOcRgPVXrYAB_retail001',
        name: '내밴드샵',
        coverUrl: 'https://placehold.co/100x100/4A90D9/ffffff?text=BAND',
        isActive: true,
        accountHolder: '정소매',
        bankAccount: '110-9876-5432',
        bankName: '신한은행',
      },
      // 스마트스토어 소매 채널
      {
        userId,
        kind: 'RETAIL' as const,
        platform: 'SMARTSTORE' as const,
        channelKey: 'smartstore_001',
        name: '스마트패션몰',
        coverUrl: 'https://placehold.co/100x100/03C75A/ffffff?text=SMART',
        isActive: true,
        accountHolder: '한스마트',
        bankAccount: '1234-56-789012',
        bankName: '농협',
      },
      // 쿠팡 소매 채널
      {
        userId,
        kind: 'RETAIL' as const,
        platform: 'COUPANG' as const,
        channelKey: 'coupang_store_001',
        name: '쿠팡 트렌디샵',
        coverUrl: 'https://placehold.co/100x100/E31837/ffffff?text=CPNG',
        isActive: true,
        accountHolder: '조쿠팡',
        bankAccount: '987-65-432101',
        bankName: 'IBK기업은행',
      },
    ]

    // 채널 생성
    const createdChannels = []
    for (const channel of channels) {
      const created = await prisma.channel.create({ data: channel })
      createdChannels.push(created)
    }

    return NextResponse.json({
      success: true,
      message: `${createdChannels.length}개 채널이 생성되었습니다.`,
      data: createdChannels.map(c => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        kind: c.kind,
      })),
    })
  } catch (error) {
    console.error('채널 시드 실패:', error)
    return NextResponse.json(
      { success: false, error: '채널 시드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
