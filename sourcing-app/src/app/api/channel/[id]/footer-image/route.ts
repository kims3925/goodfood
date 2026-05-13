export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// ~ 경로를 홈 디렉토리로 확장 (channel logo 업로드와 동일 패턴)
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

const getImageStoragePath = () => {
  const storagePath = process.env.CHANNEL_IMAGE_STORAGE_PATH
  if (!storagePath) {
    throw new Error('CHANNEL_IMAGE_STORAGE_PATH 환경변수가 설정되지 않았습니다.')
  }
  const expandedPath = expandTilde(storagePath)

  if (!existsSync(expandedPath)) {
    mkdirSync(expandedPath, { recursive: true })
  }

  return expandedPath
}

const parseChannelId = (params: { id: string }): number | null => {
  const id = parseInt(params.id, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * 본인 소유 채널인지 검증 후 channel row 반환. 권한 없으면 null.
 * 소유권은 Channel.userId === currentUser.userId 로 판별.
 */
async function loadOwnedChannel(channelId: number, userId: number) {
  return prisma.channel.findFirst({
    where: {
      id: channelId,
      userId,
      deletedAt: null,
    },
    select: { id: true, userId: true, footerImageUrl: true },
  })
}

/**
 * POST /api/channel/[id]/footer-image
 * multipart/form-data 로 푸터 이미지 업로드 → Channel.footerImageUrl 저장
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const channelId = parseChannelId(params)
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채널 ID입니다.' },
        { status: 400 }
      )
    }

    const channel = await loadOwnedChannel(channelId, currentUser.userId)
    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name) || '.jpg'
    // 충돌 방지: 채널 ID + uuid 조합 (기존 channel cover 업로드와 동일 경로 사용)
    const filename = `channel-${channelId}-footer-${uuidv4()}${ext}`
    const imageDir = getImageStoragePath()
    const filePath = path.join(imageDir, filename)

    await writeFile(filePath, buffer)

    // 채널 cover 이미지와 동일한 서빙 경로 사용
    const url = `/api/images/channel/file/${filename}`

    await prisma.channel.update({
      where: { id: channelId },
      data: { footerImageUrl: url },
    })

    return NextResponse.json({
      success: true,
      data: { url, filename },
    })
  } catch (error) {
    console.error('[footer-image] 업로드 실패:', error)
    return NextResponse.json(
      { success: false, error: '푸터 이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/channel/[id]/footer-image
 * Channel.footerImageUrl = null 으로 클리어. 파일은 보존 (다른 채널이
 * 참조할 가능성은 낮지만 안전상 GC 는 별도 운영 도구로).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const channelId = parseChannelId(params)
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채널 ID입니다.' },
        { status: 400 }
      )
    }

    const channel = await loadOwnedChannel(channelId, currentUser.userId)
    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.channel.update({
      where: { id: channelId },
      data: { footerImageUrl: null },
    })

    return NextResponse.json({
      success: true,
      message: '푸터 이미지가 해제되었습니다.',
    })
  } catch (error) {
    console.error('[footer-image] 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '푸터 이미지 해제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
