/**
 * Band Credentials API
 * 채널의 네이버 계정 정보 저장/조회/삭제
 * (실제 로그인은 발행 시점에 수행)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

interface RouteParams {
  params: { id: string }
}

/**
 * GET - 채널의 네이버 계정 정보 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const channelId = parseInt(params.id)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 채널 ID입니다.' }, { status: 400 })
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: currentUser.userId,
      },
      select: {
        id: true,
        platform: true,
        naverId: true,
        naverPassword: true,
      },
    })

    if (!channel) {
      return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (channel.platform !== 'BAND') {
      return NextResponse.json({ success: false, error: 'BAND 채널만 지원됩니다.' }, { status: 400 })
    }

    // 계정 정보 유무만 반환 (비밀번호는 노출하지 않음)
    return NextResponse.json({
      success: true,
      data: {
        hasCredentials: !!(channel.naverId && channel.naverPassword),
        naverId: channel.naverId ? channel.naverId.replace(/(.{2}).*(.{2})/, '$1***$2') : null,
      },
    })
  } catch (error: any) {
    console.error('[BandCredentialsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '계정 정보 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST - 네이버 계정 정보 저장
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const channelId = parseInt(params.id)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 채널 ID입니다.' }, { status: 400 })
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { naverId, naverPassword } = body

    if (!naverId) {
      return NextResponse.json(
        { success: false, error: '네이버 ID를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 채널 확인
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: currentUser.userId,
      },
    })

    if (!channel) {
      return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (channel.platform !== 'BAND') {
      return NextResponse.json({ success: false, error: 'BAND 채널만 지원됩니다.' }, { status: 400 })
    }

    // 계정 정보 저장 (비밀번호가 없으면 기존 비밀번호 유지)
    const updateData: { naverId: string; naverPassword?: string } = { naverId }
    if (naverPassword) {
      updateData.naverPassword = naverPassword
    }

    await prisma.channel.update({
      where: { id: channelId },
      data: updateData,
    })

    console.log(`[BandCredentialsAPI] 계정 정보 저장: channelId=${channelId}, naverId=${naverId}`)

    return NextResponse.json({
      success: true,
      message: '네이버 계정 정보가 저장되었습니다.',
    })
  } catch (error: any) {
    console.error('[BandCredentialsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '계정 정보 저장 실패' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - 계정 정보 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const channelId = parseInt(params.id)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 채널 ID입니다.' }, { status: 400 })
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 채널 확인
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: currentUser.userId,
      },
    })

    if (!channel) {
      return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 계정 정보 삭제
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        naverId: null,
        naverPassword: null,
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })

    console.log(`[BandCredentialsAPI] 계정 정보 삭제: channelId=${channelId}`)

    return NextResponse.json({
      success: true,
      message: '계정 정보가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('[BandCredentialsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '계정 정보 삭제 실패' },
      { status: 500 }
    )
  }
}
