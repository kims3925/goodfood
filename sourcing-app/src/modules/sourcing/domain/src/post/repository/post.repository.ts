import prisma from '@bandauto/db'
import type { PostListParams, PostUpdateInput, SavedPostImage } from '../types/post.types'

export class CollectedPostRepository {
  async findMany(params: PostListParams) {
    const { userId, search = '', channelId, page = 1, limit = 10, todayOnly = false } = params

    // 오늘 날짜 필터 (KST 기준)
    let createdAtFilter = {}
    if (todayOnly) {
      const now = new Date()
      // KST (UTC+9) 기준 오늘 시작/끝 시간 계산
      const kstOffset = 9 * 60 * 60 * 1000
      const kstNow = new Date(now.getTime() + kstOffset)
      const kstToday = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate())
      // UTC로 변환 (KST 00:00 -> UTC 15:00 전날)
      const todayStartUTC = new Date(kstToday.getTime() - kstOffset)
      const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000)

      createdAtFilter = {
        createdAt: {
          gte: todayStartUTC,
          lt: todayEndUTC,
        },
      }
    }

    const where = {
      userId,
      ...(channelId && { channelId }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
          { author: { contains: search } },
        ],
      }),
      ...createdAtFilter,
    }

    const total = await prisma.collectedPost.count({ where })

    const posts = await prisma.collectedPost.findMany({
      where,
      ...(limit > 0 && {
        skip: (page - 1) * limit,
        take: limit,
      }),
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            channelKey: true,
            coverUrl: true,
            kind: true,
            platform: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: 'asc' as const,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        comments: {
          orderBy: {
            createdAt: 'asc' as const,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findById(id: number) {
    return prisma.collectedPost.findFirst({
      where: { id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            channelKey: true,
            coverUrl: true,
            kind: true,
            platform: true,
          },
        },
        images: true,
        comments: true,
      },
    })
  }

  async findByExternalId(channelId: number, externalId: string) {
    return prisma.collectedPost.findFirst({
      where: {
        channelId,
        externalId,
      },
    })
  }

  async create(data: {
    userId: number
    channelId: number
    externalId: string
    title: string
    content: string
    author?: string
    comments?: Array<{ author: string; content: string }>
    savedPostImages?: SavedPostImage[]
  }) {
    const imagesToCreate = data.savedPostImages && data.savedPostImages.length > 0
      ? data.savedPostImages.map((img, index) => ({
          url: img.url,
          fileHash: img.fileHash,
          fileName: img.fileName,
          fileSize: img.fileSize,
          sortOrder: index,
        }))
      : null

    return prisma.collectedPost.create({
      data: {
        userId: data.userId,
        channelId: data.channelId,
        externalId: data.externalId,
        title: data.title,
        content: data.content,
        author: data.author,
        ...(data.comments && data.comments.length > 0 && {
          comments: {
            create: data.comments.map((comment) => ({
              author: comment.author,
              content: comment.content,
            })),
          },
        }),
        ...(imagesToCreate && {
          images: {
            create: imagesToCreate,
          },
        }),
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            channelKey: true,
            kind: true,
            platform: true,
          },
        },
        comments: true,
        images: true,
      },
    })
  }

  async update(id: number, data: PostUpdateInput) {
    return prisma.collectedPost.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.author !== undefined && { author: data.author }),
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            channelKey: true,
            kind: true,
            platform: true,
          },
        },
      },
    })
  }

  async delete(id: number) {
    return prisma.collectedPost.delete({
      where: { id },
    })
  }

  async getWithImages(id: number) {
    return prisma.collectedPost.findFirst({
      where: { id },
      include: {
        images: true,
      },
    })
  }

  /**
   * 채널 내에서 externalId 목록으로 존재하는 게시물 조회 (배치 중복 체크용)
   */
  async findManyByExternalIds(channelId: number, externalIds: string[]) {
    return prisma.collectedPost.findMany({
      where: {
        channelId,
        externalId: { in: externalIds },
      },
      select: { id: true, externalId: true },
    })
  }

  /**
   * 게시물 배치 생성 (이미지 포함)
   * 트랜잭션으로 게시물과 이미지를 함께 생성
   */
  async createMany(data: Array<{
    userId: number
    channelId: number
    externalId: string
    title: string
    content: string
    author?: string
    savedPostImages?: SavedPostImage[]
  }>) {
    // 트랜잭션으로 게시물과 이미지 일괄 생성
    const results = await prisma.$transaction(async (tx) => {
      const createdPosts = []

      for (const post of data) {
        const imagesToCreate = post.savedPostImages && post.savedPostImages.length > 0
          ? post.savedPostImages.map((img, index) => ({
              url: img.url,
              fileHash: img.fileHash,
              fileName: img.fileName,
              fileSize: img.fileSize,
              sortOrder: index,
            }))
          : null

        const created = await tx.collectedPost.create({
          data: {
            userId: post.userId,
            channelId: post.channelId,
            externalId: post.externalId,
            title: post.title,
            content: post.content,
            author: post.author,
            ...(imagesToCreate && {
              images: {
                create: imagesToCreate,
              },
            }),
          },
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                channelKey: true,
                kind: true,
                platform: true,
              },
            },
            images: true,
          },
        })
        createdPosts.push(created)
      }

      return createdPosts
    })

    return results
  }
}

// 하위 호환성을 위한 별칭 유지 (점진적 마이그레이션)
export const PostRepository = CollectedPostRepository
export const postRepository = new CollectedPostRepository()
export const collectedPostRepository = new CollectedPostRepository()
