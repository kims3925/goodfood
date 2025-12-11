import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import { getCurrentUser } from '@/modules/auth/auth.service'

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
 * POST /api/upload
 * 이미지 업로드
 */
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
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string || 'shop' // 업로드 타입 (shop, product, etc.)

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WEBP만 가능)' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 5MB를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 파일명 생성
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${timestamp}-${randomString}.${extension}`

    // 환경 변수에서 저장 경로 가져오기
    const basePath = process.env.SHOP_IMAGE_STORAGE_PATH || '~/assets/images/shop'
    const expandedBasePath = expandPath(basePath)

    // 기본 디렉토리 생성 (shop/ 폴더에 직접 저장)
    const uploadDir = expandedBasePath
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (mkdirError: any) {
      console.error('디렉토리 생성 실패:', mkdirError)
      return NextResponse.json(
        { success: false, error: `디렉토리 생성 실패: ${mkdirError.message}` },
        { status: 500 }
      )
    }

    // 파일 저장
    const filePath = path.join(uploadDir, fileName)
    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)
      console.log(`파일 저장 성공: ${filePath}`)
    } catch (writeError: any) {
      console.error('파일 저장 실패:', writeError)
      return NextResponse.json(
        { success: false, error: `파일 저장 실패: ${writeError.message}` },
        { status: 500 }
      )
    }

    // 반환할 URL (이미지 서빙용 API 경로)
    const fileUrl = `/api/image/shop/${fileName}`

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        fileName,
        filePath, // 삭제 시 사용
        size: file.size,
        type: file.type,
      },
    })
  } catch (error) {
    console.error('파일 업로드 실패:', error)
    return NextResponse.json(
      { success: false, error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
