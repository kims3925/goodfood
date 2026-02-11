import prisma, { InquiryType, InquiryStatus } from '@bandauto/db'
import type { InquiryListParams } from '../types/inquiry.types'

export class InquiryRepository {
  async findMany(params: InquiryListParams) {
    const { type, status } = params

    const where: {
      inquiryType?: InquiryType
      status?: InquiryStatus
    } = {}

    if (type && type !== 'ALL') {
      where.inquiryType = type as InquiryType
    }
    if (status && status !== 'ALL') {
      where.status = status as InquiryStatus
    }

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        inquiryType: true,
        title: true,
        content: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        shopProduct: {
          select: {
            shop: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
        },
        replies: {
          select: { id: true },
        },
      },
    })

    return inquiries.map(({ replies, shopProduct, ...inquiry }) => ({
      ...inquiry,
      shop: shopProduct?.shop
        ? { id: shopProduct.shop.id, name: shopProduct.shop.name, subdomain: shopProduct.shop.subdomain }
        : null,
      replyCount: replies?.length || 0,
    }))
  }

  async findById(id: number) {
    return prisma.inquiry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }

  async countPending(): Promise<number> {
    return prisma.inquiry.count({
      where: { status: 'PENDING' },
    })
  }

  async addReply(inquiryId: number, content: string) {
    return prisma.$transaction(async (tx) => {
      const reply = await tx.inquiryReply.create({
        data: {
          inquiryId,
          content,
          isAdmin: true,
        },
      })

      await tx.inquiry.update({
        where: { id: inquiryId },
        data: {
          status: 'ANSWERED',
          adminReply: content,
          repliedAt: new Date(),
        },
      })

      return reply
    })
  }
}

export const inquiryRepository = new InquiryRepository()
