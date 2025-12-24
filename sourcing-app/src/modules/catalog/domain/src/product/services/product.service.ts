import prisma from '@bandauto/db'
import { productRepository } from '../repository/product.repository'
import { deleteProductImageFiles } from '@/modules/utils/imageUtils'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput, OptionGroupInput, VariantInput } from '../types/product.types'

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

    // postId 기반 생성 시 channelId와 이미지 가져오기
    if (data.postId) {
      const post = await productRepository.getCollectedPostWithImages(data.postId, data.userId)
      if (!post) {
        throw new Error('게시물을 찾을 수 없습니다.')
      }

      // post에서 channelId 가져오기
      if (!channelId && post.channelId) {
        channelId = post.channelId
      }

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
        } catch {
          // rawMetadata 파싱 실패 시 무시 (요청 데이터 그대로 사용)
        }
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
    })

    // postId가 있으면 해당 CollectedProduct의 isConverted를 true로 변경
    if (data.postId) {
      await prisma.collectedProduct.updateMany({
        where: { postId: data.postId },
        data: { isConverted: true },
      })
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

    // 서버에서 실제 이미지 파일 삭제 (PRODUCT_IMAGE_STORAGE_PATH에서 삭제)
    // 다른 상품에서 같은 파일을 참조하지 않는 경우에만 삭제
    if (product.images && product.images.length > 0) {
      const fileNames = product.images
        .filter((img) => img.fileName)
        .map((img) => img.fileName as string)
      await deleteProductImageFiles(fileNames, id)
    }

    // 관련 PublishedProduct들의 ID 가져오기
    const publishedProducts = await prisma.publishedProduct.findMany({
      where: { productId: id },
      select: { id: true },
    })
    const publishedProductIds = publishedProducts.map((pp) => pp.id)

    // 관련 CartItem 삭제 (PublishedProduct와 연결된 장바구니 항목)
    if (publishedProductIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { publishedProductId: { in: publishedProductIds } },
      })
    }

    // 관련 ProductVariant들의 ID 가져오기
    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      select: { id: true },
    })
    const variantIds = variants.map((v) => v.id)

    // CartItem, OrderItem, GuestOrderItem에서 variantId 참조 해제
    if (variantIds.length > 0) {
      await Promise.all([
        prisma.cartItem.updateMany({
          where: { variantId: { in: variantIds } },
          data: { variantId: { set: null } },
        }),
        prisma.orderItem.updateMany({
          where: { variantId: { in: variantIds } },
          data: { variantId: { set: null } },
        }),
        prisma.guestOrderItem.updateMany({
          where: { variantId: { in: variantIds } },
          data: { variantId: { set: null } },
        }),
      ])
    }

    // PublishedProduct의 productId를 null로 설정 (연결 해제)
    await prisma.publishedProduct.updateMany({
      where: { productId: id },
      data: { productId: null },
    })

    return productRepository.delete(id)
  }
}

export const productService = new ProductService()
