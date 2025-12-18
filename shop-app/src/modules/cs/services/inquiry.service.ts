/**
 * Inquiry Service
 * 고객 문의 비즈니스 로직 레이어
 */

import prisma, { InquiryType, InquiryStatus } from '@bandauto/db'
import {
  ValidationError,
  NotFoundError,
} from '@/modules/common/utils/src/errors/handlers'
import { createInquiryNotification } from '@/services/notification.service'

// ============================================
// Types
// ============================================

export interface CreateInquiryDTO {
  userId: number
  inquiryType: string
  title: string
  content: string
  publishedProductId?: number
}

export interface InquiryReply {
  id: number
  content: string
  isAdmin: boolean
  createdAt: Date
}

export interface InquiryResponse {
  id: number
  inquiryType: string
  title: string
  content: string
  status: string
  adminReply: string | null
  repliedAt: Date | null
  createdAt: Date
  replies: InquiryReply[]
}

const VALID_INQUIRY_TYPES: InquiryType[] = [
  'PRODUCT',
  'DELIVERY',
  'ORDER',
  'PAYMENT',
  'RETURN',
  'EXCHANGE',
  'GENERAL',
]

/**
 * Inquiry Service
 */
export class InquiryService {
  /**
   * 문의 생성
   */
  async createInquiry(data: CreateInquiryDTO): Promise<InquiryResponse> {
    const { userId, inquiryType, title, content, publishedProductId } = data

    // 입력 검증
    this.validateInquiryInput(title, content, inquiryType)

    // 문의 생성
    const inquiry = await prisma.inquiry.create({
      data: {
        userId,
        publishedProductId: publishedProductId || null,
        inquiryType: inquiryType as InquiryType,
        title: title.trim(),
        content: content.trim(),
        isPrivate: true,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    })

    // 알림 생성 (publishedProductId가 있으면 shopId 조회 - 샵 소유자에게 알림)
    if (publishedProductId) {
      const publishedProduct = await prisma.publishedProduct.findUnique({
        where: { id: publishedProductId },
        select: {
          shopId: true,
          shop: {
            select: { userId: true },
          },
        },
      })
      if (publishedProduct?.shopId && publishedProduct?.shop?.userId) {
        createInquiryNotification(publishedProduct.shop.userId, publishedProduct.shopId, {
          id: inquiry.id,
          title: inquiry.title,
          type: inquiry.inquiryType,
          customerName: inquiry.user?.name || undefined,
        })
      }
    }

    return {
      id: inquiry.id,
      inquiryType: inquiry.inquiryType,
      title: inquiry.title,
      content: inquiry.content,
      status: inquiry.status,
      adminReply: inquiry.adminReply,
      repliedAt: inquiry.repliedAt,
      createdAt: inquiry.createdAt,
      replies: [],
    }
  }

  /**
   * 사용자별 문의 목록 조회
   */
  async findByUserId(userId: number): Promise<InquiryResponse[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const inquiries = await prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        inquiryType: true,
        title: true,
        content: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            isAdmin: true,
            createdAt: true,
          },
        },
      },
    })

    return inquiries.map((inquiry) => ({
      id: inquiry.id,
      inquiryType: inquiry.inquiryType,
      title: inquiry.title,
      content: inquiry.content,
      status: inquiry.status,
      adminReply: inquiry.adminReply,
      repliedAt: inquiry.repliedAt,
      createdAt: inquiry.createdAt,
      replies: inquiry.replies,
    }))
  }

  /**
   * 문의 상세 조회
   */
  async findById(inquiryId: number, userId?: number): Promise<InquiryResponse> {
    if (!inquiryId) {
      throw new ValidationError('문의 ID는 필수입니다')
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            isAdmin: true,
            createdAt: true,
          },
        },
      },
    })

    if (!inquiry) {
      throw new NotFoundError('문의', String(inquiryId))
    }

    // 사용자 검증 (선택적)
    if (userId && inquiry.userId !== userId) {
      throw new ValidationError('해당 문의에 접근할 권한이 없습니다')
    }

    return {
      id: inquiry.id,
      inquiryType: inquiry.inquiryType,
      title: inquiry.title,
      content: inquiry.content,
      status: inquiry.status,
      adminReply: inquiry.adminReply,
      repliedAt: inquiry.repliedAt,
      createdAt: inquiry.createdAt,
      replies: inquiry.replies,
    }
  }

  /**
   * 입력 검증
   */
  private validateInquiryInput(title: string, content: string, inquiryType: string): void {
    if (!title?.trim()) {
      throw new ValidationError('제목을 입력해 주세요')
    }

    if (!content?.trim()) {
      throw new ValidationError('내용을 입력해 주세요')
    }

    if (!VALID_INQUIRY_TYPES.includes(inquiryType as InquiryType)) {
      throw new ValidationError('유효하지 않은 문의 유형입니다')
    }
  }
}

// Singleton 인스턴스
export const inquiryService = new InquiryService()

// Factory function
export function getInquiryService(): InquiryService {
  return inquiryService
}
