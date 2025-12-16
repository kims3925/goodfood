import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 개인정보처리방침 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const where = search
      ? { name: { contains: search } }
      : {}

    const [items, total] = await Promise.all([
      prisma.privacyPolicy.findMany({
        where,
        orderBy: [{ main: 'desc' }, { sub: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.privacyPolicy.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('개인정보처리방침 목록 조회 실패:', error)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST: 개인정보처리방침 생성
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { name, content, isMainVersion } = body

    if (!name || !content) {
      return NextResponse.json({ success: false, error: '이름과 내용은 필수입니다.' }, { status: 400 })
    }

    // 버전 계산
    let main = 0
    let sub = 1

    const latestPolicy = await prisma.privacyPolicy.findFirst({
      orderBy: [{ main: 'desc' }, { sub: 'desc' }],
    })

    if (latestPolicy) {
      if (isMainVersion) {
        // main 버전 증가, sub는 0으로
        main = latestPolicy.main + 1
        sub = 0
      } else {
        // 같은 main 버전에서 sub 증가
        main = latestPolicy.main
        sub = latestPolicy.sub + 1
      }
    }

    const newPolicy = await prisma.privacyPolicy.create({
      data: {
        name,
        content,
        main,
        sub,
      },
    })

    return NextResponse.json({ success: true, data: newPolicy }, { status: 201 })
  } catch (error) {
    console.error('개인정보처리방침 생성 실패:', error)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
