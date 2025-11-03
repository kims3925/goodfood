import { NextResponse } from 'next/server'

// 메모리에 임시 저장 (실제로는 DB 사용)
let shopSettings = {
  shopName: 'Band Auto Shop',
  shopUrl: 'https://bandauto.shop',
  shopDescription: '도매 상품을 합리적인 가격에 판매하는 온라인 쇼핑몰',

  // 배너 이미지 설정
  bannerImages: [
    { id: 1, url: '', link: '', title: '배너 1' },
    { id: 2, url: '', link: '', title: '배너 2' }
  ],

  // 카테고리 설정
  categories: [
    { id: 1, name: '육류', icon: '🥩', color: 'bg-red-50', enabled: true },
    { id: 2, name: '수산물', icon: '🐟', color: 'bg-blue-50', enabled: true },
    { id: 3, name: '채소', icon: '🥬', color: 'bg-green-50', enabled: true },
    { id: 4, name: '과일', icon: '🍎', color: 'bg-orange-50', enabled: true },
    { id: 5, name: '김치', icon: '🥢', color: 'bg-yellow-50', enabled: true },
    { id: 6, name: '가공품', icon: '📦', color: 'bg-purple-50', enabled: true },
    { id: 7, name: '특가', icon: '⚡', color: 'bg-pink-50', enabled: true },
    { id: 8, name: '더보기', icon: '➕', color: 'bg-gray-50', enabled: true }
  ],

  // 섹션 표시 설정
  showTimeSale: false,
  showBestProducts: false,

  // 결제 설정
  paymentGateway: 'toss',
  tossClientKey: '',
  tossSecretKey: '',

  // 배송 설정
  defaultShippingFee: 3000,
  freeShippingAmount: 50000,
  shippingPolicy: '50,000원 이상 무료배송',

  // 마진 설정
  defaultMarginType: 'percentage',
  defaultMarginValue: 30,

  // 자동화 설정
  autoPublish: true,
  autoUpdateStock: true,
  autoUpdatePrice: false,

  isLocked: false,
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      settings: shopSettings
    })
  } catch (error) {
    console.error('Failed to load shop settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load shop settings',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // 설정 업데이트
    shopSettings = {
      ...shopSettings,
      ...body
    }

    // 실제로는 DB에 저장
    /*
    const userId = getCurrentUserId() // 현재 사용자 ID 가져오기

    await prisma.shopSettings.upsert({
      where: { userId },
      update: body,
      create: {
        userId,
        ...body
      }
    })
    */

    return NextResponse.json({
      success: true,
      message: 'Shop settings saved successfully',
      settings: shopSettings
    })

  } catch (error) {
    console.error('Failed to save shop settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save shop settings',
      },
      { status: 500 }
    )
  }
}