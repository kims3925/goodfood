import prisma from '@bandauto/db'
import type { PostListParams, PostUpdateInput, SavedImage } from '../types/post.types'

export class PostRepository {
  async findMany(params: PostListParams) {
    const { userId, search = '', page = 1, limit = 10 } = params

    const where = {
      userId,
      ...(search && {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
          { author: { contains: search } },
        ],
      }),
    }

    const total = await prisma.post.count({ where })

    const posts = await prisma.post.findMany({
      where,
      ...(limit > 0 && {
        skip: (page - 1) * limit,
        take: limit,
      }),
      include: {
        wholesaleBand: {
          select: {
            id: true,
            name: true,
            bandKey: true,
            coverUrl: true,
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
    return prisma.post.findFirst({
      where: { id },
      include: {
        wholesaleBand: {
          select: {
            name: true,
            bandKey: true,
          },
        },
        images: true,
        comments: true,
      },
    })
  }

  async findByExternalId(wholesaleBandId: number, externalId: string) {
    return prisma.post.findFirst({
      where: {
        wholesaleBandId,
        externalId,
      },
    })
  }

  async create(data: {
    userId: number
    wholesaleBandId: number
    externalId: string
    title: string
    content: string
    author?: string
    comments?: Array<{ author: string; content: string }>
    savedImages?: SavedImage[]
  }) {
    return prisma.post.create({
      data: {
        userId: data.userId,
        wholesaleBandId: data.wholesaleBandId,
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
        ...(data.savedImages && data.savedImages.length > 0 && {
          images: {
            create: data.savedImages.map((img, index) => ({
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
  }

  async update(id: number, data: PostUpdateInput) {
    return prisma.post.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.author !== undefined && { author: data.author }),
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
  }

  async delete(id: number) {
    return prisma.post.delete({
      where: { id },
    })
  }

  async getWithImages(id: number) {
    return prisma.post.findFirst({
      where: { id },
      include: {
        images: true,
      },
    })
  }
}

export const postRepository = new PostRepository()
