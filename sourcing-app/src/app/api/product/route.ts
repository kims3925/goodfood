import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { productService } from '@/modules/catalog/domain/src/product'

// GET: 상품 목록 조회
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
    const postId = searchParams.get('postId')
    const search = searchParams.get('search')
    const wholesaleBandId = searchParams.get('wholesaleBandId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const result = await productService.getList({
      userId: currentUser.userId,
      postId: postId ? parseInt(postId) : undefined,
      search: search || undefined,
      wholesaleBandId: wholesaleBandId ? parseInt(wholesaleBandId) : undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  } catch (error) {
    console.error('상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 상품 생성
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
    const { postId, name, description, categoryId, currency, price, wholesalePrice } = body

    console.log('[Product Create] Request:', { postId, name })

    if (!postId || !name) {
      return NextResponse.json(
        { success: false, error: 'postId와 name이 필요합니다.' },
        { status: 400 }
      )
    }

    const product = await productService.create({
      userId: currentUser.userId,
      postId,
      name,
      description,
      categoryId,
      currency,
      price,
      wholesalePrice,
    })

    console.log('[Product Create] Success:', product.id)

    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    console.error('상품 생성 실패:', error)

    if (error.message === '게시물을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    if (error.message === '이미 이 게시물로 생성된 상품이 있습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '상품 생성에 실패했습니다.', details: error.message },
      { status: 500 }
    )
  }
}

// PUT: 상품 수정
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, name, description, categoryId, price, wholesalePrice, status } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      )
    }

    const product = await productService.update(id, currentUser.userId, {
      name,
      description,
      categoryId,
      price,
      wholesalePrice,
      status,
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    console.error('상품 수정 실패:', error)

    if (error.message === '상품을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '상품 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 상품 삭제
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

    await productService.delete(id, currentUser.userId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('상품 삭제 실패:', error)

    if (error.message === '상품을 찾을 수 없습니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
