/**
 * Band Session Extension 다운로드 API
 * 확장 프로그램을 zip 파일로 다운로드
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

export async function GET() {
  try {
    // 확장 프로그램 폴더 경로
    const extensionPath = path.join(process.cwd(), '..', 'band-session-extension')

    // 폴더 존재 확인
    if (!fs.existsSync(extensionPath)) {
      return NextResponse.json(
        { success: false, error: '확장 프로그램 폴더를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // zip 파일 생성
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk) => chunks.push(chunk))

    // 폴더 내용 추가
    archive.directory(extensionPath, 'band-session-extension')

    await archive.finalize()

    const zipBuffer = Buffer.concat(chunks)

    // zip 파일 응답
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="band-session-extension.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('확장 프로그램 다운로드 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
