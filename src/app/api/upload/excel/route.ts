import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: '엑셀 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 파일을 Buffer로 변환
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 파일명 생성 (타임스탬프 포함)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')
    const fileName = `upload_${timestamp}_${file.name}`
    
    // 저장 경로
    const uploadDir = path.join(process.cwd(), 'public', 'downloads')
    const filePath = path.join(uploadDir, fileName)

    // 파일 저장
    await writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl: `/downloads/${fileName}`,
      size: file.size,
      type: file.type
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}