import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * ~ 경로를 실제 홈 디렉토리 경로로 변환
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

/**
 * 파일 확장자로 MIME 타입 결정
 */
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

/**
 * GET /api/image/shop/[...path]
 * 쇼핑몰 이미지 서빙
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParts } = await params
    if (!pathParts || pathParts.length < 1) {
      return NextResponse.json(
        { success: false, error: '잘못된 경로입니다.' },
        { status: 400 }
      )
    }

    // 환경 변수에서 저장 경로 가져오기
    const basePath = process.env.SHOP_IMAGE_STORAGE_PATH || '~/assets/images/shop'
    const expandedBasePath = expandPath(basePath)

    // 전체 파일 경로 (shop/ 폴더에 직접 저장된 파일)
    const filePath = path.join(expandedBasePath, ...pathParts)

    // 경로 순회 공격 방지
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(expandedBasePath)) {
      return NextResponse.json(
        { success: false, error: '잘못된 경로입니다.' },
        { status: 400 }
      )
    }

    // 파일 읽기
    const fileBuffer = await readFile(filePath)
    const mimeType = getMimeType(pathParts[pathParts.length - 1])

    // 이미지 응답
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    console.error('이미지 서빙 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
