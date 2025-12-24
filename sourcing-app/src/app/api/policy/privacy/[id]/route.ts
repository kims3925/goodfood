export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 개인정보처리방침 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const policy = await prisma.privacyPolicy.findUnique({
      where: { id: parseInt(id) },
    })

    if (!policy) {
      return NextResponse.json({ success: false, error: '개인정보처리방침을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: policy })
  } catch (error) {
    console.error('개인정보처리방침 조회 실패:', error)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PUT: 개인정보처리방침 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, content } = body

    const policy = await prisma.privacyPolicy.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(content && { content }),
      },
    })

    return NextResponse.json({ success: true, data: policy })
  } catch (error) {
    console.error('개인정보처리방침 수정 실패:', error)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE: 개인정보처리방침 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    await prisma.privacyPolicy.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('개인정보처리방침 삭제 실패:', error)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
