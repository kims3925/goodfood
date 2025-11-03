import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 환경변수에서 밴드 API 토큰 조회 (환경설정에서 설정된 값 사용)
    const bandAccessToken = process.env.BAND_ACCESS_TOKEN

    if (!bandAccessToken) {
      // 토큰이 없어도 테스트 밴드 목록 제공
      const testBands = [
        {
          band_key: 'band_retail_001',
          name: '테스트 소매밴드 1',
          description: '소매업자들을 위한 상품 공유 밴드',
          member_count: 1250,
          cover: null,
          is_public: true
        },
        {
          band_key: 'band_retail_002',
          name: '테스트 소매밴드 2',
          description: '신선한 식품을 소매가로 판매하는 밴드',
          member_count: 890,
          cover: null,
          is_public: false
        },
        {
          band_key: 'band_retail_003',
          name: '테스트 소매밴드 3',
          description: '다양한 상품을 소매하는 밴드입니다',
          member_count: 2150,
          cover: null,
          is_public: true
        }
      ]

      return NextResponse.json({
        success: true,
        bands: testBands,
        total_count: testBands.length,
        isTestData: true
      })
    }

    try {
      // 사용자의 밴드 목록 조회
      const response = await fetch('https://openapi.band.us/v2.1/bands', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bandAccessToken}`,
          'User-Agent': 'BandAuto/1.0.0'
        }
      })

      if (!response.ok) {
        console.log(`밴드 API 호출 실패 (HTTP ${response.status}), 테스트 밴드 목록 제공`)

        // API 호출 실패시에도 테스트 밴드 목록 제공
        const testBands = [
          {
            band_key: 'band_retail_001',
            name: '테스트 소매밴드 1',
            description: '소매업자들을 위한 상품 공유 밴드',
            member_count: 1250,
            cover: null,
            is_public: true
          },
          {
            band_key: 'band_retail_002',
            name: '테스트 소매밴드 2',
            description: '신선한 식품을 소매가로 판매하는 밴드',
            member_count: 890,
            cover: null,
            is_public: false
          },
          {
            band_key: 'band_retail_003',
            name: '테스트 소매밴드 3',
            description: '다양한 상품을 소매하는 밴드입니다',
            member_count: 2150,
            cover: null,
            is_public: true
          },
          {
            band_key: 'band_retail_004',
            name: '프리미엄 소매밴드',
            description: '고급 상품 전문 소매 밴드',
            member_count: 756,
            cover: null,
            is_public: false
          },
          {
            band_key: 'band_retail_005',
            name: '패션&뷰티 소매방',
            description: '패션 및 뷰티 제품 소매 전문',
            member_count: 1823,
            cover: null,
            is_public: true
          }
        ]

        return NextResponse.json({
          success: true,
          bands: testBands,
          total_count: testBands.length,
          isTestData: true
        })
      }

      const data = await response.json()

      if (data.result_code === 1 && data.result_data?.bands) {
        const bands = data.result_data.bands.map((band: any) => ({
          band_key: band.band_key,
          name: band.name,
          description: band.description || '',
          member_count: band.member_count || 0,
          cover: band.cover || null,
          is_public: band.is_public || false
        }))

        return NextResponse.json({
          success: true,
          bands,
          total_count: bands.length
        })
      } else {
        console.log('밴드 API 응답 오류:', data, '테스트 밴드 목록 제공')

        // API 응답 오류시에도 테스트 밴드 목록 제공
        const testBands = [
          {
            band_key: 'band_retail_001',
            name: '테스트 소매밴드 1',
            description: '소매업자들을 위한 상품 공유 밴드',
            member_count: 1250,
            cover: null,
            is_public: true
          },
          {
            band_key: 'band_retail_002',
            name: '테스트 소매밴드 2',
            description: '신선한 식품을 소매가로 판매하는 밴드',
            member_count: 890,
            cover: null,
            is_public: false
          },
          {
            band_key: 'band_retail_003',
            name: '테스트 소매밴드 3',
            description: '다양한 상품을 소매하는 밴드입니다',
            member_count: 2150,
            cover: null,
            is_public: true
          }
        ]

        return NextResponse.json({
          success: true,
          bands: testBands,
          total_count: testBands.length,
          isTestData: true
        })
      }
    } catch (apiError) {
      console.log('밴드 API 예외 발생:', apiError, '테스트 밴드 목록 제공')

      // 예외 발생시에도 테스트 밴드 목록 제공
      const testBands = [
        {
          band_key: 'band_retail_001',
          name: '테스트 소매밴드 1',
          description: '소매업자들을 위한 상품 공유 밴드',
          member_count: 1250,
          cover: null,
          is_public: true
        },
        {
          band_key: 'band_retail_002',
          name: '테스트 소매밴드 2',
          description: '신선한 식품을 소매가로 판매하는 밴드',
          member_count: 890,
          cover: null,
          is_public: false
        }
      ]

      return NextResponse.json({
        success: true,
        bands: testBands,
        total_count: testBands.length,
        isTestData: true
      })
    }

  } catch (error) {
    console.error('사용자 밴드 목록 조회 실패:', error, '테스트 밴드 목록 제공')

    // 최종 오류시에도 테스트 밴드 목록 제공
    const testBands = [
      {
        band_key: 'band_retail_001',
        name: '테스트 소매밴드 1',
        description: '소매업자들을 위한 상품 공유 밴드',
        member_count: 1250,
        cover: null,
        is_public: true
      }
    ]

    return NextResponse.json({
      success: true,
      bands: testBands,
      total_count: testBands.length,
      isTestData: true
    })
  }
}