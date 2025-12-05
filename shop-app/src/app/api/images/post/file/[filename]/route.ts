import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import os from 'os'

// ~ 경로를 홈 디렉토리로 확장
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

const getImageStoragePath = () => {
  const storagePath = process.env.POST_IMAGE_STORAGE_PATH
  if (!storagePath) {
    throw new Error('POST_IMAGE_STORAGE_PATH 환경변수가 설정되지 않았습니다.')
  }
  return expandTilde(storagePath)
}

// MIME 타입 결정
const getMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * GET /api/images/post/file/[filename]
 *
 * Serve post image file by filename
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename) {
      return NextResponse.json(
        { success: false, error: '파일명이 필요합니다.' },
        { status: 400 }
      )
    }

    const imageDir = getImageStoragePath()
    const filePath = path.join(imageDir, filename)

    // 보안: 디렉토리 트래버설 방지
    const resolvedPath = path.resolve(filePath)
    const resolvedDir = path.resolve(imageDir)
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 파일 경로입니다.' },
        { status: 400 }
      )
    }

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const fileBuffer = await readFile(filePath)
    const mimeType = getMimeType(filename)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('게시물 이미지 서빙 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지를 불러올 수 없습니다.' },
      { status: 500 }
    )
  }
}
