export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * 경로의 ~ (홈 디렉토리)를 실제 경로로 변환
 */
function expandHomePath(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2))
  }
  return filepath
}

/**
 * 이미지 파일 제공 API
 * GET /api/assets/images/[filename]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params

    // 환경 변수에서 저장 경로 가져오기
    const storagePath = process.env.IMAGE_STORAGE_PATH || '~/assets/images'
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, filename)

    // 보안: 디렉토리 탐색 공격 방지
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(imagesDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 403 }
      )
    }

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      )
    }

    // 파일 읽기
    const fileBuffer = fs.readFileSync(filePath)

    // 파일 확장자에 따른 Content-Type 설정
    const ext = path.extname(filename).toLowerCase()
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    }
    const contentType = contentTypeMap[ext] || 'application/octet-stream'

    // 이미지 반환
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('이미지 제공 실패:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}
