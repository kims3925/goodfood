import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import prisma from '@bandauto/db'

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
 * 버퍼에서 SHA-256 해시 생성
 */
function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * 로컬 게시물 이미지 API 경로에서 파일명 추출
 * @param url API 경로 (예: /api/images/post/file/abc123.jpg)
 * @returns 파일명 또는 null
 */
function extractPostImageFileName(url: string): string | null {
  const postImagePattern = /^\/api\/images\/post\/file\/(.+)$/
  const match = url.match(postImagePattern)
  return match ? match[1] : null
}

/**
 * 로컬 게시물 이미지 파일을 읽어서 버퍼 반환
 * @param fileName 파일명
 * @returns 파일 버퍼 또는 null
 */
function readLocalPostImage(fileName: string): Buffer | null {
  try {
    const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath)
    }
    return null
  } catch (error) {
    console.error(`[Product Image] 로컬 게시물 이미지 읽기 실패: ${fileName}`, error)
    return null
  }
}

/**
 * 상품 이미지 전용: URL에서 이미지 다운로드 및 서버에 저장
 * 환경변수 PRODUCT_IMAGE_STORAGE_PATH에 저장
 * 동일한 해시의 이미지가 이미 존재하면 기존 이미지 정보 반환 (중복 방지)
 * 로컬 게시물 이미지 경로(/api/images/post/file/...)인 경우 직접 파일 복사
 * @param imageUrl 원본 이미지 URL 또는 로컬 API 경로
 * @returns { fileName: string, url: string, fileSize: number, fileHash: string, isExisting: boolean }
 */
export async function downloadAndSaveProductImage(imageUrl: string): Promise<{
  fileName: string
  url: string
  fileSize: number
  fileHash: string
  isExisting: boolean
}> {
  try {
    let buffer: Buffer

    // 로컬 게시물 이미지 경로인 경우 직접 파일 읽기
    const postImageFileName = extractPostImageFileName(imageUrl)
    if (postImageFileName) {
      const localBuffer = readLocalPostImage(postImageFileName)
      if (!localBuffer) {
        throw new Error(`로컬 게시물 이미지 파일을 찾을 수 없음: ${postImageFileName}`)
      }
      buffer = localBuffer
      console.log(`[Product Image] 로컬 게시물 이미지에서 복사: ${postImageFileName}`)
    } else {
      // 외부 URL에서 이미지 다운로드
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    // 파일 해시 생성
    const fileHash = generateFileHash(buffer)

    // 동일 해시의 기존 이미지 확인
    const existingImage = await prisma.productImage.findFirst({
      where: { fileHash },
      select: { fileName: true, url: true, fileSize: true, fileHash: true },
    })

    if (existingImage && existingImage.fileName) {
      // 기존 파일이 실제로 존재하는지 확인
      const storagePath = process.env.PRODUCT_IMAGE_STORAGE_PATH || 'assets/images/product'
      const imagesDir = expandHomePath(storagePath)
      const existingFilePath = path.join(imagesDir, existingImage.fileName)

      if (fs.existsSync(existingFilePath)) {
        console.log(`[Product Image] 중복 이미지 발견, 기존 파일 사용: ${existingImage.fileName}`)
        return {
          fileName: existingImage.fileName,
          url: existingImage.url,
          fileSize: existingImage.fileSize || buffer.length,
          fileHash: existingImage.fileHash!,
          isExisting: true,
        }
      }
    }

    // 파일 확장자 추출 (없으면 jpg로 기본 설정)
    let ext: string
    if (postImageFileName) {
      // 로컬 파일에서 확장자 추출
      ext = path.extname(postImageFileName) || '.jpg'
    } else {
      // URL에서 확장자 추출
      try {
        const urlPath = new URL(imageUrl).pathname
        ext = path.extname(urlPath) || '.jpg'
      } catch {
        ext = path.extname(imageUrl) || '.jpg'
      }
    }

    // 파일명 생성: uuid_timestamp.ext
    const uuid = generateShortUUID()
    const timestamp = getTimestamp()
    const fileName = `${uuid}_${timestamp}${ext}`

    // 환경 변수에서 상품 이미지 저장 경로 가져오기
    const storagePath = process.env.PRODUCT_IMAGE_STORAGE_PATH || 'assets/images/product'

    // ~ (홈 디렉토리) 확장
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    // 파일 저장
    fs.writeFileSync(filePath, buffer)

    // 웹에서 접근 가능한 API 경로 반환
    const url = `/api/images/product/file/${fileName}`

    return {
      fileName,
      url,
      fileSize: buffer.length,
      fileHash,
      isExisting: false,
    }
  } catch (error) {
    console.error('상품 이미지 다운로드 실패:', error)
    throw error
  }
}

/**
 * 여러 상품 이미지를 순차적으로 다운로드
 * @param imageUrls 이미지 URL 배열
 * @returns 저장된 이미지 정보 배열
 */
export async function downloadAndSaveProductImages(
  imageUrls: string[]
): Promise<Array<{ fileName: string; url: string; fileSize: number; fileHash: string; isExisting: boolean }>> {
  const results = []

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const result = await downloadAndSaveProductImage(imageUrls[i])
      results.push(result)
    } catch (error) {
      console.error(`상품 이미지 다운로드 실패 (${i + 1}/${imageUrls.length}):`, error)
      // 실패한 이미지는 건너뛰고 계속 진행
    }
  }

  return results
}

/**
 * 상품 이미지 파일 삭제 (다른 상품에서 참조하지 않는 경우에만)
 * @param fileName 파일명 (예: uuid_timestamp.jpg)
 * @param excludeProductId 제외할 상품 ID (삭제 중인 상품)
 */
export async function deleteProductImageFile(fileName: string, excludeProductId?: number): Promise<void> {
  try {
    // 같은 파일명을 참조하는 다른 상품 이미지가 있는지 확인
    const otherReferences = await prisma.productImage.count({
      where: {
        fileName,
        ...(excludeProductId ? { productId: { not: excludeProductId } } : {}),
      },
    })

    if (otherReferences > 0) {
      console.log(`[Product Image] 다른 상품에서 참조 중, 파일 유지: ${fileName} (${otherReferences}개 참조)`)
      return
    }

    const storagePath = process.env.PRODUCT_IMAGE_STORAGE_PATH || 'assets/images/product'
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`상품 이미지 파일 삭제 완료: ${fileName}`)
    } else {
      console.warn(`상품 이미지 파일이 존재하지 않음: ${fileName}`)
    }
  } catch (error) {
    console.error(`상품 이미지 파일 삭제 실패 (${fileName}):`, error)
  }
}

/**
 * 여러 상품 이미지 파일을 삭제 (다른 상품에서 참조하지 않는 경우에만)
 * @param fileNames 파일명 배열
 * @param excludeProductId 제외할 상품 ID (삭제 중인 상품)
 */
export async function deleteProductImageFiles(fileNames: string[], excludeProductId?: number): Promise<void> {
  for (const fileName of fileNames) {
    await deleteProductImageFile(fileName, excludeProductId)
  }
}

/**
 * 게시물 이미지 전용: URL에서 이미지 다운로드 및 서버에 저장
 * 환경변수 POST_IMAGE_STORAGE_PATH에 저장
 * 동일한 해시의 이미지가 이미 존재하면 기존 이미지 정보 반환 (중복 방지)
 * @param imageUrl 원본 이미지 URL
 * @returns { fileName: string, url: string, fileSize: number, fileHash: string, isExisting: boolean }
 */
export async function downloadAndSavePostImage(imageUrl: string): Promise<{
  fileName: string
  url: string
  fileSize: number
  fileHash: string
  isExisting: boolean
}> {
  try {
    // 이미지 다운로드
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 파일 해시 생성
    const fileHash = generateFileHash(buffer)

    // 동일 해시의 기존 이미지 확인
    const existingImage = await prisma.collectedPostImage.findFirst({
      where: { fileHash },
      select: { fileName: true, url: true, fileSize: true, fileHash: true },
    })

    if (existingImage && existingImage.fileName) {
      // 기존 파일이 실제로 존재하는지 확인
      const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'
      const imagesDir = expandHomePath(storagePath)
      const existingFilePath = path.join(imagesDir, existingImage.fileName)

      if (fs.existsSync(existingFilePath)) {
        console.log(`[Post Image] 중복 이미지 발견, 기존 파일 사용: ${existingImage.fileName}`)
        return {
          fileName: existingImage.fileName,
          url: existingImage.url,
          fileSize: existingImage.fileSize || buffer.length,
          fileHash: existingImage.fileHash!,
          isExisting: true,
        }
      }
    }

    // 파일 확장자 추출 (없으면 jpg로 기본 설정)
    const urlPath = new URL(imageUrl).pathname
    const ext = path.extname(urlPath) || '.jpg'

    // 파일명 생성: uuid_timestamp.ext
    const uuid = generateShortUUID()
    const timestamp = getTimestamp()
    const fileName = `${uuid}_${timestamp}${ext}`

    // 환경 변수에서 게시물 이미지 저장 경로 가져오기
    const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'

    // ~ (홈 디렉토리) 확장
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    // 파일 저장
    fs.writeFileSync(filePath, buffer)

    // 웹에서 접근 가능한 API 경로 반환
    const url = `/api/images/post/file/${fileName}`

    return {
      fileName,
      url,
      fileSize: buffer.length,
      fileHash,
      isExisting: false,
    }
  } catch (error) {
    console.error('게시물 이미지 다운로드 실패:', error)
    throw error
  }
}

/**
 * 여러 게시물 이미지를 순차적으로 다운로드
 * @param imageUrls 이미지 URL 배열
 * @returns 저장된 이미지 정보 배열
 */
export async function downloadAndSavePostImages(
  imageUrls: string[]
): Promise<Array<{ fileName: string; url: string; fileSize: number; fileHash: string; isExisting: boolean }>> {
  const results = []

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const result = await downloadAndSavePostImage(imageUrls[i])
      results.push(result)
    } catch (error) {
      console.error(`게시물 이미지 다운로드 실패 (${i + 1}/${imageUrls.length}):`, error)
      // 실패한 이미지는 건너뛰고 계속 진행
    }
  }

  return results
}

/**
 * 게시물 이미지 파일 삭제 (다른 게시물에서 참조하지 않는 경우에만)
 * @param fileName 파일명 (예: uuid_timestamp.jpg)
 * @param excludePostId 제외할 게시물 ID (삭제 중인 게시물)
 */
export async function deletePostImageFile(fileName: string, excludePostId?: number): Promise<void> {
  try {
    // 같은 파일명을 참조하는 다른 게시물 이미지가 있는지 확인
    const otherReferences = await prisma.collectedPostImage.count({
      where: {
        fileName,
        ...(excludePostId ? { postId: { not: excludePostId } } : {}),
      },
    })

    if (otherReferences > 0) {
      console.log(`[Post Image] 다른 게시물에서 참조 중, 파일 유지: ${fileName} (${otherReferences}개 참조)`)
      return
    }

    const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'
    const imagesDir = expandHomePath(storagePath)
    const filePath = path.join(imagesDir, fileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`게시물 이미지 파일 삭제 완료: ${fileName}`)
    } else {
      console.warn(`게시물 이미지 파일이 존재하지 않음: ${fileName}`)
    }
  } catch (error) {
    console.error(`게시물 이미지 파일 삭제 실패 (${fileName}):`, error)
  }
}

/**
 * 여러 게시물 이미지 파일을 삭제 (다른 게시물에서 참조하지 않는 경우에만)
 * @param fileNames 파일명 배열
 * @param excludePostId 제외할 게시물 ID (삭제 중인 게시물)
 */
export async function deletePostImageFiles(fileNames: string[], excludePostId?: number): Promise<void> {
  for (const fileName of fileNames) {
    await deletePostImageFile(fileName, excludePostId)
  }
}
