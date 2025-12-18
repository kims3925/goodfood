export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import os from 'os'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { v4 as uuidv4 } from 'uuid'

// ~ 경로를 홈 디렉토리로 확장
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

const getImageStoragePath = () => {
  const storagePath = process.env.PRODUCT_IMAGE_STORAGE_PATH
  if (!storagePath) {
    throw new Error('PRODUCT_IMAGE_STORAGE_PATH 환경변수가 설정되지 않았습니다.')
  }
  const expandedPath = expandTilde(storagePath)

  // 디렉토리가 없으면 생성
  if (!existsSync(expandedPath)) {
    mkdirSync(expandedPath, { recursive: true })
  }

  return expandedPath
}

// POST: 이미지 업로드
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
    const productId = formData.get('productId')
    const files = formData.getAll('files') as File[]

    if (!productId || !files.length) {
      return NextResponse.json(
        { success: false, error: 'productId와 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 상품 소유권 확인
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(productId as string),
        userId: currentUser.userId,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 현재 최대 sortOrder 조회
    const maxSortOrder = await prisma.productImage.aggregate({
      where: { productId: product.id },
      _max: { sortOrder: true },
    })

    let currentSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1
    const imageDir = getImageStoragePath()
    const uploadedImages = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = path.extname(file.name) || '.jpg'
      const filename = `${uuidv4()}${ext}`
      const filePath = path.join(imageDir, filename)

      // 파일 저장
      await writeFile(filePath, buffer)

      // DB에 저장 (url은 파일 서빙 API 경로로 저장)
      const url = `/api/images/product/file/${filename}`
      const image = await prisma.productImage.create({
        data: {
          productId: product.id,
          url,
          sortOrder: currentSortOrder++,
        },
      })

      uploadedImages.push(image)
    }

    // 첫 번째 이미지가 없으면 썸네일로 설정
    if (!product.thumbnailUrl && uploadedImages.length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          thumbnailUrl: uploadedImages[0].url,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: uploadedImages,
    })
  } catch (error) {
    console.error('이미지 업로드 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
