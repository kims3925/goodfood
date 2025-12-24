export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import os from 'os'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { v4 as uuidv4 } from 'uuid'

// ~ 경로를 홈 디렉토리로 확장
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

  // 디렉토리가 없으면 생성
  if (!existsSync(expandedPath)) {
    mkdirSync(expandedPath, { recursive: true })
  }

  return expandedPath
}

// POST: 채널 로고 이미지 업로드
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

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
    const filename = `${uuidv4()}${ext}`
    const imageDir = getImageStoragePath()
    const filePath = path.join(imageDir, filename)

    // 파일 저장
    await writeFile(filePath, buffer)

    // URL은 파일 서빙 API 경로로 반환
    const url = `/api/images/channel/file/${filename}`

    return NextResponse.json({
      success: true,
      data: {
        url,
        filename,
      },
    })
  } catch (error) {
    console.error('채널 이미지 업로드 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 채널 로고 이미지 삭제
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
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { success: false, error: '파일명이 필요합니다.' },
        { status: 400 }
      )
    }

    const imageDir = getImageStoragePath()
    const filePath = path.join(imageDir, filename)

    // 파일 존재 확인 후 삭제
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    return NextResponse.json({
      success: true,
      message: '이미지가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('채널 이미지 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
