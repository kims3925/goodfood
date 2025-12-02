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

// MIME 타입 매핑
const getMimeType = (ext: string): string => {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
}

// GET: 이미지 서빙
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // 파일명 검증 (경로 탐색 공격 방지)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: '잘못된 파일명입니다.' },
        { status: 400 }
      )
    }

    // 환경변수에서 이미지 저장 경로 가져오기
    const imageStoragePath = process.env.IMAGE_STORAGE_PATH
    if (!imageStoragePath) {
      return NextResponse.json(
        { success: false, error: '서버 설정 오류' },
        { status: 500 }
      )
    }

    const imageDir = expandTilde(imageStoragePath)
    const filePath = path.join(imageDir, filename)

    // 파일 존재 확인
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 파일 읽기
    const fileBuffer = await readFile(filePath)
    const ext = path.extname(filename)
    const mimeType = getMimeType(ext)

    // 이미지 응답 (Buffer를 Uint8Array로 변환)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('이미지 서빙 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지를 불러올 수 없습니다.' },
      { status: 500 }
    )
  }
}
