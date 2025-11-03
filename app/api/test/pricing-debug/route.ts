import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // 모든 도매 밴드의 가격정책 조회
    const allBands = await prisma.wholesaleBand.findMany({
      select: {
        id: true,
        name: true,
        pricingPolicy: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // 최근 수집된 상품들 조회 (지난 7일간)
    const posts = await prisma.collectedPost.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 지난 7일
        }
      },
      include: {
        wholesaleBand: {
          select: {
            name: true,
            pricingPolicy: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // 가격정책이 있는 밴드들 조회
    const bandsWithPolicy = await prisma.wholesaleBand.findMany({
      where: {
        pricingPolicy: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        pricingPolicy: true,
        _count: {
          select: {
            collectedPosts: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
              }
            }
          }
        }
      }
    })

    // 가격정책이 적용된 상품들 확인
    const postsWithPricing = posts.filter(post => {
      return post.adjustedPrice && post.policyApplied
    })

    const analysis = {
      totalPosts: posts.length,
      postsWithPolicy: posts.filter(p => p.wholesaleBand.pricingPolicy).length,
      postsWithAdjustedPrice: postsWithPricing.length,
      bandsWithPolicy: bandsWithPolicy.map(band => ({
        name: band.name,
        policy: band.pricingPolicy,
        postCount: band._count.collectedPosts
      })),
      samplePosts: posts.slice(0, 5).map(post => ({
        id: post.id,
        title: post.title?.substring(0, 50) + '...',
        bandName: post.wholesaleBand.name,
        pricingPolicy: post.wholesaleBand.pricingPolicy,
        extractedPrice: post.extractedPrice,
        adjustedPrice: post.adjustedPrice,
        policyApplied: post.policyApplied,
        priceCalculation: post.priceCalculation,
        hasShippingFee: !!post.shippingFee,
        shippingFee: post.shippingFee,
        // 가격 계산 상세 분석
        priceCalculationParsed: post.priceCalculation ? (() => {
          try {
            return JSON.parse(post.priceCalculation)
          } catch {
            return null
          }
        })() : null
      }))
    }

    return NextResponse.json({
      success: true,
      date: 'last 7 days',
      allBands,
      analysis
    })

  } catch (error) {
    console.error('가격정책 디버깅 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

// POST: 가격정책 수정
export async function POST() {
  try {
    // 올바른 가격정책 문구
    const correctedPolicy = `1. 판매가 계산:
- 수집된 게시물 가격 기준으로 다음 마진 추가
- 10,000원 이하: +1,000원
- 10,001~20,000원: +2,000원  
- 20,001~30,000원: +3,000원
- 30,001~40,000원: +4,000원
- 40,001~50,000원: +5,000원
- 50,001원 이상: +6,000원

2. 공급가(원가) 계산:
- 공급가 = 수집된 게시물 가격 × 90% (즉, 수집된 가격의 90%를 공급가로 산정)

최종 결과:
- 공급가: 수집가격 × 0.9
- 판매가: 수집가격 + 구간별 마진`

    // 요한이네 밴드 찾기
    const band = await prisma.wholesaleBand.findFirst({
      where: {
        name: {
          contains: '요한'
        }
      }
    })

    if (!band) {
      return NextResponse.json({
        success: false,
        error: '요한이네 밴드를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const originalPolicy = band.pricingPolicy

    // 가격정책 업데이트
    const updatedBand = await prisma.wholesaleBand.update({
      where: {
        id: band.id
      },
      data: {
        pricingPolicy: correctedPolicy
      },
      select: {
        id: true,
        name: true,
        pricingPolicy: true
      }
    })

    return NextResponse.json({
      success: true,
      message: '가격정책이 성공적으로 수정되었습니다.',
      bandName: updatedBand.name,
      before: originalPolicy,
      after: updatedBand.pricingPolicy
    })

  } catch (error) {
    console.error('가격정책 수정 실패:', error)
    return NextResponse.json({
      success: false,
      error: '가격정책을 수정할 수 없습니다.'
    }, { status: 500 })
  }
}