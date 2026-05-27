import prisma, { BundleShippingType, Product } from '@bandauto/db'
import { productRepository } from '../repository/product.repository'
import { downloadAndSaveProductImages } from '@/modules/utils/imageUtils'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput, OptionGroupInput, VariantInput } from '../types/product.types'
import type { BatchResult, ProgressCallback } from '@/types/batch.types'
import { createEmptyBatchResult } from '@/types/batch.types'

export class ProductService {
  async getList(params: ProductListParams) {
    return productRepository.findMany(params)
  }

  async getById(id: number) {
    return productRepository.findById(id)
  }

  async create(data: ProductCreateInput) {
    let channelId = data.channelId || undefined
    let thumbnailUrl: string | null = data.thumbnailUrl || null
    let imageUrls: string[] = data.imageUrls || []

    // rawMetadata에서 추출한 데이터 (요청에 없으면 rawMetadata에서 가져옴)
    let options: OptionGroupInput[] = data.options || []
    let variants: VariantInput[] = data.variants || []
    let shippingFee: number | undefined = data.shippingFee ?? undefined
    let shippingInfo: string | undefined = data.shippingInfo ?? undefined
    let bundleMaxQty: number | undefined = data.bundleMaxQty ?? undefined
    let categoryId: string | undefined = data.categoryId ?? undefined
    let wholesalePrice: number | undefined = data.wholesalePrice ?? undefined
    let price: number | undefined = data.price ?? undefined
    // 정책 기반 배송비 타입 (호출자가 명시하면 그 값을, 아니면 DB 정책에서 폴백 조회)
    let policyShippingType: 'separate' | 'included' | undefined = data.policyShippingType ?? undefined

    // postId 기반 생성 시 channelId와 이미지 가져오기
    let sourceProductName: string | undefined = undefined
    if (data.postId) {
      const post = await productRepository.getCollectedPostWithImages(data.postId, data.userId)
      if (!post) {
        throw new Error('게시물을 찾을 수 없습니다.')
      }

      // post에서 channelId 가져오기
      if (!channelId && post.channelId) {
        channelId = post.channelId
      }

      // 도매방 원본 품명 (발주 텍스트용)
      sourceProductName = post.title

      // 이미지 가져오기
      if (!thumbnailUrl && post.images?.[0]?.url) {
        thumbnailUrl = post.images[0].url
      }
      if (imageUrls.length === 0 && post.images) {
        imageUrls = post.images.map((img: any) => img.url)
      }

      // CollectedProduct에서 rawMetadata 가져오기
      const collectedProduct = await productRepository.findCollectedProductByPostId(data.postId)
      if (collectedProduct?.rawMetadata) {
        try {
          const metadata = typeof collectedProduct.rawMetadata === 'string'
            ? JSON.parse(collectedProduct.rawMetadata)
            : collectedProduct.rawMetadata

          // options: 요청에 없으면 rawMetadata에서 추출
          if (options.length === 0 && metadata.options?.length > 0) {
            options = metadata.options
          }

          // variants: 요청에 없으면 rawMetadata에서 추출
          if (variants.length === 0 && metadata.variants?.length > 0) {
            variants = metadata.variants
          }

          // shippingFee: 요청에 없으면 rawMetadata에서 추출
          if (shippingFee === undefined) {
            if (metadata.shipping?.shippingFee !== undefined) {
              shippingFee = metadata.shipping.shippingFee
            } else if (metadata.shippingFee !== undefined) {
              shippingFee = metadata.shippingFee
            }
          }

          // shippingInfo: 요청에 없으면 rawMetadata에서 추출
          if (shippingInfo === undefined) {
            if (metadata.shipping?.shippingInfo) {
              shippingInfo = metadata.shipping.shippingInfo
            } else if (metadata.shippingInfo) {
              shippingInfo = metadata.shippingInfo
            }
          }

          // bundleMaxQty: 요청에 없으면 rawMetadata에서 추출
          if (bundleMaxQty === undefined) {
            if (metadata.shipping?.bundleMaxQty !== undefined) {
              bundleMaxQty = metadata.shipping.bundleMaxQty
            } else if (metadata.bundleMaxQty !== undefined) {
              bundleMaxQty = metadata.bundleMaxQty
            }
          }

          // categoryId: 요청에 없으면 rawMetadata에서 추출
          if (!categoryId && metadata.category) {
            categoryId = metadata.category
          }

          // wholesalePrice: 요청에 없으면 rawMetadata에서 추출
          if (wholesalePrice === undefined && metadata.wholesalePrice !== undefined) {
            wholesalePrice = metadata.wholesalePrice
          }

          // price: 요청에 없으면 rawMetadata에서 추출
          if (price === undefined && metadata.price !== undefined) {
            price = metadata.price
          }

          // policyShippingType: 자동 파이프라인이 rawMetadata 에 저장한 값 활용
          if (policyShippingType === undefined && metadata.policyShippingType) {
            const v = String(metadata.policyShippingType).toLowerCase()
            if (v === 'separate' || v === 'included') {
              policyShippingType = v
            }
          }
        } catch {
          // rawMetadata 파싱 실패 시 무시 (요청 데이터 그대로 사용)
        }
      }
    }

    // policyShippingType 폴백: 채널에 활성 PricingPolicy 가 있으면 그 content 의
    // "배송비:" 항목을 파싱해 사용. 호출자가 명시하지 않은 경우만 작동.
    if (policyShippingType === undefined && channelId) {
      try {
        const { parsePolicyShippingType } = await import('@/lib/policy-shipping')
        const prisma = (await import('@bandauto/db')).default
        const policy = await prisma.pricingPolicy.findFirst({
          where: { userId: data.userId, channelId, isActive: true },
          orderBy: { updatedAt: 'desc' },
          select: { content: true },
        })
        const parsed = parsePolicyShippingType(policy?.content)
        if (parsed) policyShippingType = parsed
      } catch (e) {
        // 정책 조회 실패는 무시 — 기존 키워드 추론으로 폴백
      }
    }

    const product = await productRepository.create({
      ...data,
      channelId,
      thumbnailUrl,
      imageUrls,
      options,
      variants,
      shippingFee,
      shippingInfo,
      bundleMaxQty,
      categoryId,
      wholesalePrice,
      price,
      policyShippingType,
      sourceProductName,
      collectedPostId: data.postId,
    })

    // postId가 있으면 CollectedProduct 처리 (post/list에서 제거되도록)
    if (data.postId) {
      // 기존 CollectedProduct가 있으면 isConverted 업데이트
      const updatedCount = await prisma.collectedProduct.updateMany({
        where: { postId: data.postId },
        data: { isConverted: true },
      })

      // CollectedProduct가 없으면 새로 생성 (post/list 필터 정합성 보장)
      if (updatedCount.count === 0) {
        try {
          await prisma.collectedProduct.create({
            data: {
              userId: data.userId,
              postId: data.postId,
              name: data.name || null,
              description: data.description || null,
              currency: data.currency || 'KRW',
              isConverted: true,
            },
          })
        } catch {
          // unique constraint 등 실패 시 무시 (이미 존재하는 경우)
        }
      }
    }

    return product
  }

  async update(id: number, userId: number, data: ProductUpdateInput) {
    const existing = await productRepository.findByIdAndUser(id, userId)
    if (!existing) {
      throw new Error('상품을 찾을 수 없습니다.')
    }

    return productRepository.update(id, data)
  }

  async delete(id: number, userId: number) {
    const product = await productRepository.getWithImages(id, userId)
    if (!product) {
      throw new Error('상품을 찾을 수 없습니다.')
    }

    // 소프트삭제 (개발계획서 Phase 0 — 데이터 유실 재발 방지):
    // 과거의 destructive cascade(이미지 파일 물리삭제 / CartItem 삭제 / variant·productId 참조 해제 /
    // 하드삭제)는 모두 제거한다. 그래야 복원(restore)이 가능하고 주문 이력이 보존된다.
    //
    // 처리: Product 와 그에 연결된 발행물(ShopProduct/ChannelProduct)을 deletedAt 으로 비노출 처리.
    //  - productId 링크/이미지 파일/주문·장바구니 이력은 보존 → POST /api/product/restore 로 복원 가능.
    //  - 활성 목록 쿼리는 deletedAt=null 필터를 쓰므로 사용자 화면에서는 즉시 사라진다.
    const now = new Date()
    await prisma.$transaction([
      prisma.shopProduct.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.channelProduct.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.product.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      }),
    ])

    return { id, deletedAt: now }
  }

  /**
   * CollectedProduct 배열에서 Product 배치 생성 (자동화 파이프라인에서 사용)
   *
   * @param params.userId 사용자 ID
   * @param params.collectedProductIds 수집상품 ID 배열
   * @param params.onProgress 진행 콜백 (선택)
   */
  async createFromCollectedProducts(params: {
    userId: number
    collectedProductIds: number[]
    onProgress?: ProgressCallback<Product>
  }): Promise<BatchResult<Product>> {
    const { userId, collectedProductIds, onProgress } = params
    const result = createEmptyBatchResult<Product>()

    if (collectedProductIds.length === 0) {
      return result
    }

    // CollectedProduct 조회
    const collectedProducts = await prisma.collectedProduct.findMany({
      where: {
        id: { in: collectedProductIds },
        userId,
        isConverted: false, // 아직 변환되지 않은 수집상품만
      },
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

    result.total = collectedProductIds.length
    result.skippedCount = collectedProductIds.length - collectedProducts.length

    console.log(`[ProductService.createFromCollectedProducts] Total: ${collectedProductIds.length}, Found: ${collectedProducts.length}, Skipped: ${result.skippedCount}`)

    for (let i = 0; i < collectedProducts.length; i++) {
      const collectedProduct = collectedProducts[i]

      try {
        // rawMetadata에서 AI 분석 결과 추출
        let metadata: any = {}
        if (collectedProduct.rawMetadata) {
          try {
            metadata = typeof collectedProduct.rawMetadata === 'string'
              ? JSON.parse(collectedProduct.rawMetadata)
              : collectedProduct.rawMetadata
          } catch {
            // 파싱 실패 시 빈 객체 사용
          }
        }

        const options = metadata.options || []
        const variants = metadata.variants || []
        const wholesalePrice = metadata.wholesalePrice ?? null
        const price = metadata.price ?? null
        const shipping = metadata.shipping || {
          shippingFee: metadata.shippingFee ?? null,
          shippingInfo: metadata.shippingInfo ?? null,
        }
        const bundleMaxQty = metadata.bundleMaxQty ?? metadata.shipping?.bundleMaxQty ?? null

        // 합배송 타입 자동 추론
        let bundleShippingType: BundleShippingType = BundleShippingType.NONE
        const shippingInfoStr = String(shipping.shippingInfo || '')
        const shippingFeeNum = typeof shipping.shippingFee === 'number' ? shipping.shippingFee : 0

        const isShippingIncluded = /배송비\s*포함|택배비\s*포함|무료\s*배송|배송\s*무료/.test(shippingInfoStr)

        if (isShippingIncluded) {
          bundleShippingType = BundleShippingType.INCLUDED
        } else if (shippingFeeNum > 0) {
          bundleShippingType = BundleShippingType.SEPARATE
        }

        // 게시물 이미지 URL 수집
        const imageUrls = collectedProduct.post.images.map((img) => img.url)

        // 이미지 다운로드 (트랜잭션 외부에서 수행 - 외부 I/O)
        let downloadedImages: Awaited<ReturnType<typeof downloadAndSaveProductImages>> = []
        if (imageUrls.length > 0) {
          try {
            downloadedImages = await downloadAndSaveProductImages(imageUrls)
          } catch (imageError) {
            // 이미지 실패해도 상품 생성은 계속 진행
            console.error(`[ProductService.createFromCollectedProducts] Image download failed for collectedProduct ${collectedProduct.id}:`, imageError)
          }
        }

        // 트랜잭션으로 다중 테이블 변경 처리
        const product = await prisma.$transaction(async (tx) => {
          // 1. Product 생성
          const newProduct = await tx.product.create({
            data: {
              userId,
              channelId: collectedProduct.post.channelId,
              name: collectedProduct.name || '상품명 없음',
              description: collectedProduct.description || null,
              categoryId: metadata.category || null,
              currency: collectedProduct.currency || 'KRW',
              wholesalePrice: typeof wholesalePrice === 'number' ? wholesalePrice : null,
              price: typeof price === 'number' ? price : null,
              shippingFee: typeof shipping.shippingFee === 'number' ? shipping.shippingFee : null,
              shippingInfo: typeof shipping.shippingInfo === 'string' ? shipping.shippingInfo : null,
              bundleMaxQty: typeof bundleMaxQty === 'number' ? bundleMaxQty : null,
              bundleShippingType,
              thumbnailUrl: collectedProduct.post.images[0]?.url || null,
              options: options.length
                ? {
                    create: options.flatMap((opt: any, groupIndex: number) =>
                      (opt.values || []).map((value: string, valueIndex: number) => ({
                        groupName: opt.groupName,
                        value,
                        sortOrder: groupIndex * 100 + valueIndex,
                      }))
                    ),
                  }
                : undefined,
              variants: variants.length
                ? {
                    create: variants.map((v: any) => ({
                      optionSummary: v.optionSummary ?? null,
                      wholesalePrice: v.wholesalePrice ?? null,
                      price: v.price ?? 0,
                    })),
                  }
                : undefined,
            },
          })

          // 2. ProductImage 저장 및 썸네일 업데이트
          if (downloadedImages.length > 0) {
            await tx.productImage.createMany({
              data: downloadedImages.map((img, index) => ({
                productId: newProduct.id,
                url: img.url,
                fileHash: img.fileHash,
                fileName: img.fileName,
                fileSize: img.fileSize,
                sortOrder: index,
              })),
            })

            await tx.product.update({
              where: { id: newProduct.id },
              data: { thumbnailUrl: downloadedImages[0].url },
            })
          }

          // 3. 수집상품의 isConverted를 true로 업데이트
          await tx.collectedProduct.update({
            where: { id: collectedProduct.id },
            data: { isConverted: true },
          })

          return newProduct
        })

        result.successCount++
        result.results.push({
          success: true,
          data: product,
        })

        if (onProgress) {
          await onProgress({
            current: i,
            total: collectedProducts.length,
            result: { success: true, data: product },
            itemId: collectedProduct.id,
          })
        }

        console.log(`[ProductService.createFromCollectedProducts] Created product ${product.id} from collectedProduct ${collectedProduct.id}`)
      } catch (error: any) {
        result.failedCount++
        result.results.push({
          success: false,
          error: error.message || '상품 생성 실패',
          errorType: 'PERMANENT',
        })

        if (onProgress) {
          await onProgress({
            current: i,
            total: collectedProducts.length,
            result: { success: false, error: error.message },
            itemId: collectedProduct.id,
          })
        }

        console.error(`[ProductService.createFromCollectedProducts] Failed for collectedProduct ${collectedProduct.id}:`, error.message)
      }
    }

    console.log(`[ProductService.createFromCollectedProducts] Completed: ${result.successCount} success, ${result.failedCount} failed, ${result.skippedCount} skipped`)
    return result
  }
}

export const productService = new ProductService()
