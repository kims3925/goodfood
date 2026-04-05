export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 소싱조건 목록 조회
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 })

    const conditions = await prisma.sourcingCondition.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: conditions })
  } catch (error) {
    console.error('소싱조건 조회 실패:', error)
    return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 })
  }
}

// POST: 소싱조건 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 })

    const body = await request.json()
    const condition = await prisma.sourcingCondition.create({
      data: {
        userId: user.userId,
        name: body.name,
        categories: body.categories || [],
        minPrice: body.minPrice || null,
        maxPrice: body.maxPrice || null,
        minMarginRate: body.minMarginRate || null,
        includeKeywords: body.includeKeywords || null,
        excludeKeywords: body.excludeKeywords || null,
        channelIds: body.channelIds || null,
        prioritySourcing: body.prioritySourcing || false,
        maxDailyCount: body.maxDailyCount || null,
        schedule: body.schedule || null,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, data: condition })
  } catch (error) {
    console.error('소싱조건 생성 실패:', error)
    return NextResponse.json({ success: false, error: '생성 실패' }, { status: 500 })
  }
}

// PATCH: 소싱조건 수정
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 })

    const body = await request.json()
    const { id, ...updateData } = body

    const condition = await prisma.sourcingCondition.updateMany({
      where: { id, userId: user.userId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: condition })
  } catch (error) {
    console.error('소싱조건 수정 실패:', error)
    return NextResponse.json({ success: false, error: '수정 실패' }, { status: 500 })
  }
}

// DELETE: 소싱조건 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')

    await prisma.sourcingCondition.deleteMany({
      where: { id, userId: user.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('소싱조건 삭제 실패:', error)
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 })
  }
}
