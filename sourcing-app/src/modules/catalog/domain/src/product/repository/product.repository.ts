import prisma, { ChannelKind, BundleShippingType } from '@bandauto/db'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput } from '../types/product.types'
import { downloadAndSaveProductImages } from '@/modules/utils/imageUtils'

/**
 * 옵션 이름에서 bundleUnit(합배송 단위 수)을 자동 추출
 * 예: "2박스 (2.8kg)" → 2, "3세트" → 3, "1kg (2팩)" → 1
 */
function extractBundleUnit(optionSummary: string | null | undefined): number {
  if (!optionSummary) return 1

  // "2박스", "3세트", "2팩" 등의 패턴 매칭 (옵션 이름 시작 부분)
  const match = optionSummary.match(/^(\d+)\s*(박스|세트|팩|개입|묶음)/i)
  if (match) {
    const num = parseInt(match[1], 10)
    return num > 0 ? num : 1
  }

  return 1
}

export class ProductRepository {
  async findMany(params: ProductListParams) {
    const {
      userId,
      channelId,
      search,
      sourcePlatform,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params

    const where: any = { userId, deletedAt: null } // Soft Delete 필터링

    if (channelId) {
      where.channelId = channelId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // sourcePlatform 필터: 채널의 플랫폼
    if (sourcePlatform) {
      where.channel = {
        platform: sourcePlatform,
      }
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const total = await prisma.product.count({ where })

    const products = await prisma.product.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            coverUrl: true,
            platform: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          orderBy: { id: 'asc' },
        },
        channelProducts: {
          where: {
            channel: {
              kind: ChannelKind.RETAIL,
            },
          },
          include: {
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 발행 상태 계산해서 추가
    const productsWithPublishStatus = products.map((product) => {
      const channelPublishes = product.channelProducts

      const hasChannelPublish = channelPublishes.length > 0

      // 발행된 채널 ID 목록
      const publishedChannelIds = channelPublishes
        .map((pp) => pp.channelId)
        .filter((id): id is number => id !== null && id !== undefined)

      // 발행 요약 계산
      let publishSummary = '미발행'
      if (hasChannelPublish) {
        publishSummary = '발행됨'
      }

      return {
        ...product,
        publishStatus: {
          retailBand: hasChannelPublish,
        },
        publishedChannelIds,
        publishSummary,
      }
    })

    // 전체 통계 계산 (필터 조건에 맞는 전체 상품 대상)
    const baseWhere = { userId, deletedAt: null }

    // 발행완료 수: channelProducts가 1개 이상인 상품
    const publishedCount = await prisma.product.count({
      where: {
        ...baseWhere,
        channelProducts: {
          some: {
            channel: {
              kind: ChannelKind.RETAIL,
            },
          },
        },
      },
    })

    // 미발행 수: 전체 - 발행완료
    const totalAll = await prisma.product.count({ where: baseWhere })
    const unpublishedCount = totalAll - publishedCount

    return {
      data: productsWithPublishStatus,
      total,
      page,
      limit,
      stats: {
        total: totalAll,
        published: publishedCount,
        unpublished: unpublishedCount,
      },
    }
  }

  async findById(id: number) {
    return prisma.product.findFirst({
      where: { id },
    })
  }

  async findByIdAndUser(id: number, userId: number) {
    return prisma.product.findFirst({
      where: { id, userId },
    })
  }

  async getWithImages(id: number, userId: number) {
    return prisma.product.findFirst({
      where: { id, userId },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  }

  async findByChannelId(channelId: number) {
    return prisma.product.findMany({
      where: { channelId, deletedAt: null }, // Soft Delete 필터링
    })
  }

  async findCollectedProductByPostId(postId: number) {
    return prisma.collectedProduct.findFirst({
      where: { postId },
      include: {
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })
  }

  async getCollectedProductById(id: number) {
    return prisma.collectedProduct.findFirst({
      where: { id },
      include: {
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })
  }

  async create(data: ProductCreateInput & { thumbnailUrl?: string | null; imageUrls?: string[] }) {
    // 합배송 타입 자동 추론
    // 1. shippingInfo에 "배송비 포함", "택배비 포함", "무료배송" 등 명확한 패턴이 있으면 → INCLUDED
    // 2. shippingFee > 0 이면 → SEPARATE (배송비 별도형)
    // 3. 그 외 → NONE
    let bundleShippingType: BundleShippingType = BundleShippingType.NONE
    const shippingInfoStr = String(data.shippingInfo || '')
    const shippingFeeNum = typeof data.shippingFee === 'number' ? data.shippingFee : 0

    // "배송비 포함", "택배비 포함", "무료배송" 등 명확한 패턴만 INCLUDED로 판단
    // 단순히 "포함"만 있으면 "합배송 포함" 같은 오탐 발생
    const isShippingIncluded = /배송비\s*포함|택배비\s*포함|무료\s*배송|배송\s*무료/.test(shippingInfoStr)

    if (isShippingIncluded) {
      bundleShippingType = BundleShippingType.INCLUDED
    } else if (shippingFeeNum > 0) {
      bundleShippingType = BundleShippingType.SEPARATE
    }

    // 상품 생성 (options와 variants 포함)
    const product = await prisma.product.create({
      data: {
        userId: data.userId,
        channelId: data.channelId || null,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        currency: data.currency || 'KRW',
        wholesalePrice: data.wholesalePrice || null,
        price: data.price || null,
        shippingFee: data.shippingFee || null,
        shippingInfo: data.shippingInfo || null,
        bundleMaxQty: data.bundleMaxQty || 1,
        bundleShippingType,
        thumbnailUrl: data.thumbnailUrl || null,
        options: data.options?.length
          ? {
              create: data.options.flatMap((opt: any, groupIndex: number) => {
                if ('value' in opt && typeof opt.value === 'string') {
                  return [{
                    groupName: opt.groupName,
                    value: opt.value,
                    sortOrder: groupIndex,
                  }]
                }
                if (Array.isArray(opt.values)) {
                  return opt.values.map((value: string, valueIndex: number) => ({
                    groupName: opt.groupName,
                    value,
                    sortOrder: groupIndex * 100 + valueIndex,
                  }))
                }
                return []
              }),
            }
          : undefined,
        variants: data.variants?.length
          ? {
              create: data.variants.map((v) => ({
                optionSummary: v.optionSummary ?? null,
                wholesalePrice: v.wholesalePrice ?? null,
                price: v.price ?? 0,
                // bundleUnit: 명시적으로 전달되면 사용, 아니면 옵션 이름에서 자동 추출
                bundleUnit: v.bundleUnit ?? extractBundleUnit(v.optionSummary),
              })),
            }
          : undefined,
      },
    })

    // 이미지 URL이 있으면 다운로드하여 ProductImage에 저장
    if (data.imageUrls && data.imageUrls.length > 0) {
      try {
        const downloadedImages = await downloadAndSaveProductImages(data.imageUrls)

        if (downloadedImages.length > 0) {
          await prisma.productImage.createMany({
            data: downloadedImages.map((img, index) => ({
              productId: product.id,
              url: img.url,
              fileHash: img.fileHash,
              fileName: img.fileName,
              fileSize: img.fileSize,
              sortOrder: index,
            })),
          })

          if (!product.thumbnailUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { thumbnailUrl: downloadedImages[0].url },
            })
          }
        }
      } catch {
        // 이미지 저장 실패해도 상품은 생성됨
      }
    }

    return product
  }

  async update(id: number, data: ProductUpdateInput) {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice
    if (data.price !== undefined) updateData.price = data.price
    if (data.shippingFee !== undefined) updateData.shippingFee = data.shippingFee
    if (data.shippingInfo !== undefined) updateData.shippingInfo = data.shippingInfo
    if (data.bundleMaxQty !== undefined) updateData.bundleMaxQty = data.bundleMaxQty
    // bundleUnit은 ProductVariant에만 존재하므로 Product 업데이트에서 제외

    if (data.options !== undefined) {
      await prisma.productOption.deleteMany({ where: { productId: id } })
      if (data.options.length > 0) {
        await prisma.productOption.createMany({
          data: data.options.map((opt: any, idx: number) => ({
            productId: id,
            groupName: opt.groupName,
            value: opt.value,
            sortOrder: opt.sortOrder ?? idx,
          })),
        })
      }
    }

    if (data.variants !== undefined) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })
      if (data.variants.length > 0) {
        await prisma.productVariant.createMany({
          data: data.variants.map((v: any) => ({
            productId: id,
            optionSummary: v.optionSummary ?? null,
            wholesalePrice: v.wholesalePrice ?? null,
            price: v.price ?? 0,
            // bundleUnit: 명시적으로 전달되면 사용, 아니면 옵션 이름에서 자동 추출
            bundleUnit: v.bundleUnit ?? extractBundleUnit(v.optionSummary),
          })),
        })
      }
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: number) {
    return prisma.product.delete({
      where: { id },
    })
  }

  async getCollectedPostWithImages(postId: number, userId: number) {
    return prisma.collectedPost.findFirst({
      where: { id: postId, userId },
      include: {
        channel: {
          select: {
            id: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  }
}

export const productRepository = new ProductRepository()
