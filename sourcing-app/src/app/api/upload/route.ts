import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
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

// POST: 파일 업로드
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증 (이미지만 허용)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 환경변수에서 이미지 저장 경로 가져오기
    const imageStoragePath = process.env.IMAGE_STORAGE_PATH
    if (!imageStoragePath) {
      console.error('IMAGE_STORAGE_PATH 환경변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { success: false, error: '서버 설정 오류: 이미지 저장 경로가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 업로드 디렉토리 생성
    const uploadDir = expandTilde(imageStoragePath)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 고유한 파일명 생성
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const fileName = `${timestamp}-${randomStr}${ext}`
    const filePath = path.join(uploadDir, fileName)

    // 파일 저장
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 접근 가능한 URL 반환 (이미지 서빙 API를 통해 접근)
    const fileUrl = `/api/images/${fileName}`

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        fileName: fileName,
        originalName: file.name,
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
