import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { downloadAndSaveImages } from '@/modules/utils/imageUtils'
import fs from 'fs'
import path from 'path'
import os from 'os'

const prisma = new PrismaClient()

/**
 * 경로의 ~ (홈 디렉토리)를 실제 경로로 변환
 */
function expandHomePath(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2))
  }
  return filepath
}

// GET: 게시물 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
            { author: { contains: search } },
          ],
        }),
      },
      include: {
        wholesaleBand: {
          select: {
            name: true,
            bandKey: true,
            coverUrl: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        comments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: posts,
    })
  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: 게시물 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      wholesaleBandId,
      externalId,
      title,
      content,
      originalContent,
      author,
      publishedAt,
      comments,
      images,
    } = body

    // 필수 필드 검증
    if (!userId || !wholesaleBandId || !externalId || !title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다.',
        },
        { status: 400 }
      )
    }

    // 중복 체크 (같은 도매밴드의 같은 externalId)
    const existing = await prisma.post.findFirst({
      where: {
        wholesaleBandId,
        externalId,
        deletedAt: null,
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 등록된 게시물입니다.',
        },
        { status: 409 }
      )
    }

    // 이미지가 있으면 다운로드 및 저장
    let savedImages: Array<{ name: string; relativePath: string; fileSize: number }> = []
    if (images && images.length > 0) {
      try {
        savedImages = await downloadAndSaveImages(images)
      } catch (error) {
        console.error('이미지 저장 실패:', error)
        // 이미지 저장 실패해도 게시물은 생성 (이미지 없이)
      }
    }

    // 게시물 생성 (댓글 + 이미지 포함)
    const post = await prisma.post.create({
      data: {
        userId,
        wholesaleBandId,
        externalId,
        title,
        content,
        originalContent: originalContent || content,
        author,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        status: 'COLLECTED',
        // 댓글이 있으면 함께 생성
        ...(comments && comments.length > 0 && {
          comments: {
            create: comments.map((comment: any) => ({
              author: comment.author,
              content: comment.content,
              publishedAt: comment.published_at ? new Date(comment.published_at) : null,
            })),
          },
        }),
        // 이미지가 있으면 함께 생성
        ...(savedImages.length > 0 && {
          images: {
            create: savedImages.map((img, index) => ({
              name: img.name,
              imageUrl: img.relativePath,
              fileSize: img.fileSize,
              sortOrder: index,
            })),
          },
        }),
      },
      include: {
        wholesaleBand: {
          select: {
            name: true,
            bandKey: true,
          },
        },
        comments: true,
        images: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error('게시물 등록 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 등록에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// PUT: 게시물 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, content, author, status } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 게시물 존재 확인
    const existing = await prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '게시물을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 게시물 수정
    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(author !== undefined && { author }),
        ...(status && { status }),
      },
      include: {
        wholesaleBand: {
          select: {
            name: true,
            bandKey: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error('게시물 수정 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 수정에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// DELETE: 게시물 삭제 (Hard Delete)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 게시물 및 이미지 정보 조회
    const post = await prisma.post.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null,
      },
      include: {
        images: true, // 이미지 정보 포함
      },
    })

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          error: '게시물을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 1. 실제 이미지 파일 삭제
    if (post.images && post.images.length > 0) {
      const storagePath = process.env.IMAGE_STORAGE_PATH || '~/assets/images'
      const imagesDir = expandHomePath(storagePath)

      for (const image of post.images) {
        try {
          const filePath = path.join(imagesDir, image.name)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log(`이미지 파일 삭제 완료: ${image.name}`)
          }
        } catch (error) {
          console.error(`이미지 파일 삭제 실패: ${image.name}`, error)
          // 파일 삭제 실패해도 계속 진행
        }
      }
    }

    // 2. DB에서 게시물 삭제 (CASCADE로 댓글과 이미지 레코드도 자동 삭제됨)
    await prisma.post.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({
      success: true,
      message: '게시물이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('게시물 삭제 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 삭제에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
