/**
 * Band 세션 관리 API
 * Chrome Extension에서 세션 쿠키 저장/조회/삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// CORS 헤더 (Chrome Extension에서 접근 허용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * OPTIONS: CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * GET: 세션 상태 조회
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404, headers: corsHeaders }
      )
    }

    const hasSession = !!channel.bandSessionCookie
    const expiresAt = channel.sessionExpiresAt
    const isValid = hasSession && expiresAt ? new Date(expiresAt) > new Date() : false

    return NextResponse.json({
      success: true,
      data: {
        hasSession,
        isValid,
        expiresAt,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('세션 상태 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * PUT: Chrome Extension에서 쿠키 직접 저장
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const body = await request.json()
    const { cookieString } = body

    if (!cookieString) {
      return NextResponse.json(
        { success: false, error: '쿠키 데이터가 없습니다.' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 채널 존재 확인
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // 쿠키 저장 (14일 만료)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: cookieString,
        sessionExpiresAt: expiresAt,
      },
    })

    console.log(`[BandSession] 세션 저장 완료: channelId=${channelId}, name=${channel.name}`)

    return NextResponse.json(
      {
        success: true,
        message: '세션이 저장되었습니다.',
        data: {
          channelId,
          channelName: channel.name,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('세션 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * DELETE: 세션 삭제
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })

    console.log(`[BandSession] 세션 삭제 완료: channelId=${channelId}`)

    return NextResponse.json(
      { success: true, message: '세션이 삭제되었습니다.' },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('세션 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
