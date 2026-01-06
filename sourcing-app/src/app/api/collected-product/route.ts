export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { collectedProductService } from '@/modules/catalog/domain/src/collected-product'

// GET: 수집상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const channelId = searchParams.get('channelId')
    const sourcePlatform = searchParams.get('sourcePlatform')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const excludeConverted = searchParams.get('excludeConverted') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // 조건 생성
    const where: any = {
      userId: currentUser.userId,
    }

    // 가공상품으로 변환된 상품 제외 (excludeConverted=true인 경우)
    if (excludeConverted) {
      where.isConverted = false
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { post: { title: { contains: search } } },
      ]
    }

    // post 관련 필터 조건 생성
    const postFilter: any = {}

    if (channelId) {
      postFilter.channelId = parseInt(channelId)
    }

    // sourcePlatform 필터: 수집 출처 플랫폼
    if (sourcePlatform) {
      postFilter.channel = {
        platform: sourcePlatform,
      }
    }

    // post 필터가 있으면 적용
    if (Object.keys(postFilter).length > 0) {
      where.post = postFilter
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const [data, total] = await Promise.all([
      prisma.collectedProduct.findMany({
        where,
        select: {
          id: true,
          userId: true,
          postId: true,
          name: true,
          description: true,
          currency: true,
          rawMetadata: true,
          isConverted: true,
          createdAt: true,
          updatedAt: true,
          post: {
            include: {
              channel: {
                select: {
                  id: true,
                  name: true,
                  coverUrl: true,
                },
              },
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.collectedProduct.count({ where }),
    ])

    // rawMetadata JSON 문자열을 객체로 파싱
    const parsedData = data.map((item) => ({
      ...item,
      rawMetadata: item.rawMetadata ? JSON.parse(item.rawMetadata) : null,
    }))

    return NextResponse.json({
      success: true,
      data: parsedData,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('수집상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '수집상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 수집상품 등록 (CollectedProductService 사용 - 자동화와 동일한 로직)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { postId, name, description, currency, rawMetadata } = body

    console.log('[CollectedProduct POST] Request:', { postId, name, hasRawMetadata: !!rawMetadata })

    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'postId가 필요합니다.' },
        { status: 400 }
      )
    }

    // CollectedProductService를 사용하여 생성 (중복 체크, 게시물 확인 포함)
    const collectedProduct = await collectedProductService.create({
      userId: currentUser.userId,
      postId,
      name: name || null,
      description: description || null,
      currency: currency || 'KRW',
      rawMetadata: rawMetadata || null,
    })

    console.log('[CollectedProduct POST] Created:', collectedProduct.id)

    // rawMetadata JSON 문자열을 객체로 파싱하여 반환
    const parsedProduct = collectedProductService.parseRawMetadata(collectedProduct)

    return NextResponse.json({
      success: true,
      data: parsedProduct,
    })
  } catch (error: any) {
    console.error('[CollectedProduct POST] Error:', error)

    // 서비스에서 던진 에러 처리
    if (error.message === '이미 해당 게시물로 등록된 수집상품이 있습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }
    if (error.message === '게시물을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '수집상품 등록에 실패했습니다.', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE: 수집상품 삭제
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      )
    }

    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    // 수집상품 확인
    const collectedProduct = await prisma.collectedProduct.findFirst({
      where: { id, userId: currentUser.userId },
    })

    if (!collectedProduct) {
      return NextResponse.json(
        { success: false, error: '수집상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.collectedProduct.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('수집상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '수집상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
