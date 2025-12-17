/**
 * Shop Settings API Routes
 * 쇼핑몰 설정 조회 API
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/shop/settings
 * 쇼핑몰 설정 조회
 */
export async function GET(req: NextRequest) {
  try {
    // 기본 설정 반환 (향후 DB에서 가져오도록 확장 가능)
    const settings = {
      bannerImages: [
        {
          id: 1,
          url: 'https://via.placeholder.com/800x400/FF6B6B/FFFFFF?text=오늘의+특가',
          link: '/main?filter=sale',
          title: '오늘의 특가',
        },
        {
          id: 2,
          url: 'https://via.placeholder.com/800x400/4ECDC4/FFFFFF?text=신상품+입고',
          link: '/main?filter=new',
          title: '신상품 입고',
        },
        {
          id: 3,
          url: 'https://via.placeholder.com/800x400/F7B731/FFFFFF?text=베스트+상품',
          link: '/main?filter=best',
          title: '베스트 상품',
        },
      ],
      categories: [
        { name: '육류', icon: '🥩', color: 'bg-red-50', enabled: true },
        { name: '수산물', icon: '🐟', color: 'bg-blue-50', enabled: true },
        { name: '채소', icon: '🥬', color: 'bg-green-50', enabled: true },
        { name: '과일', icon: '🍎', color: 'bg-orange-50', enabled: true },
        { name: '김치', icon: '🥢', color: 'bg-yellow-50', enabled: true },
        { name: '가공품', icon: '📦', color: 'bg-purple-50', enabled: true },
        { name: '특가', icon: '⚡', color: 'bg-pink-50', enabled: true },
        { name: '더보기', icon: '➕', color: 'bg-gray-50', enabled: true },
      ],
      showTimeSale: true,
      showBestProducts: true,
      tossClientKey: process.env.TOSS_PAYMENTS_CLIENT_KEY || '',
    }

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error: any) {
    console.error('Shop settings GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '설정 조회 실패' },
      { status: 500 }
    )
  }
}
