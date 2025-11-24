import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'

/**
 * UUID 16자리 생성
 */
function generateShortUUID(): string {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * 현재 시간을 파일명 형식으로 포맷 (yyyy-mm-dd_HH-mm-ss)
 */
function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

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
 * URL에서 이미지 다운로드 및 서버에 저장
 * @param imageUrl 원본 이미지 URL
 * @returns { name: string, relativePath: string, fileSize: number }
 */
export async function downloadAndSaveImage(imageUrl: string): Promise<{
  name: string
  relativePath: string
  fileSize: number
}> {
  try {
    // 이미지 다운로드
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 파일 확장자 추출 (없으면 jpg로 기본 설정)
    const urlPath = new URL(imageUrl).pathname
    const ext = path.extname(urlPath) || '.jpg'

    // 파일명 생성: uuid_timestamp.ext
    const uuid = generateShortUUID()
    const timestamp = getTimestamp()
    const fileName = `${uuid}_${timestamp}${ext}`

    // 환경 변수에서 저장 경로 가져오기
    const storagePath = process.env.IMAGE_STORAGE_PATH || '~/assets/images'

    // ~ (홈 디렉토리) 확장
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    // 파일 저장
    fs.writeFileSync(filePath, buffer)

    // 웹에서 접근 가능한 API 경로 반환 (API 라우트 구조와 일치)
    const relativePath = `/api/assets/images/${fileName}`

    return {
      name: fileName,
      relativePath,
      fileSize: buffer.length,
    }
  } catch (error) {
    console.error('이미지 다운로드 실패:', error)
    throw error
  }
}

/**
 * 여러 이미지를 순차적으로 다운로드
 * @param imageUrls 이미지 URL 배열
 * @returns 저장된 이미지 정보 배열
 */
export async function downloadAndSaveImages(
  imageUrls: string[]
): Promise<Array<{ name: string; relativePath: string; fileSize: number }>> {
  const results = []

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const result = await downloadAndSaveImage(imageUrls[i])
      results.push(result)
    } catch (error) {
      console.error(`이미지 다운로드 실패 (${i + 1}/${imageUrls.length}):`, error)
      // 실패한 이미지는 건너뛰고 계속 진행
    }
  }

  return results
}
