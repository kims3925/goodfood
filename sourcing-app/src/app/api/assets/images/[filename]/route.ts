import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import os from 'os'

const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

const getImageStoragePath = () => {
  // 이미지가 ~/assets/images/ 폴더에 직접 저장되어 있음
  return expandTilde('~/assets/images')
}

const getMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename) {
      return NextResponse.json({ error: '파일명이 필요합니다.' }, { status: 400 })
    }

    const imageDir = getImageStoragePath()
    const filePath = path.join(imageDir, filename)

    // 보안: 디렉토리 트래버설 방지
    const resolvedPath = path.resolve(filePath)
    const resolvedDir = path.resolve(imageDir)
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: '유효하지 않은 경로' }, { status: 400 })
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: '이미지 없음' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': getMimeType(filename),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('이미지 서빙 실패:', error)
    return NextResponse.json({ error: '이미지 로드 실패' }, { status: 500 })
  }
}
