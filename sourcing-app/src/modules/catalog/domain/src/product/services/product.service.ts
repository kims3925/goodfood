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
    let collectedProductId = data.collectedProductId || null
    let thumbnailUrl: string | null = data.thumbnailUrl || null
    let imageUrls: string[] = data.imageUrls || []

    // rawMetadata에서 추출한 데이터 (요청에 없으면 rawMetadata에서 가져옴)
    let options: OptionGroupInput[] = data.options || []
    let variants: VariantInput[] = data.variants || []
    let shippingFee: number | undefined = data.shippingFee
    let shippingInfo: string | undefined = data.shippingInfo
    let categoryId: string | undefined = data.categoryId

    // postId 기반 생성 (하위 호환)
    if (!collectedProductId && data.postId) {
      const post = await productRepository.getCollectedPostWithImages(data.postId, data.userId)
      if (!post) {
        throw new Error('게시물을 찾을 수 없습니다.')
      }

      const existingCollected = await productRepository.findCollectedProductByPostId(data.postId)
      if (existingCollected?.products?.length) {
        throw new Error('이미 이 게시물로 생성된 상품이 있습니다.')
      }

      if (existingCollected) {
        collectedProductId = existingCollected.id
        thumbnailUrl = thumbnailUrl || existingCollected.post?.images?.[0]?.url || null
        if (imageUrls.length === 0 && existingCollected.post?.images) {
          imageUrls = existingCollected.post.images.map((img: any) => img.url)
        }
      } else {
        const collected = await productRepository.createCollectedProductFromPost({
          userId: data.userId,
          postId: data.postId,
          name: data.name,
          description: data.description,
          currency: data.currency,
        })
        collectedProductId = collected.id
        thumbnailUrl = thumbnailUrl || post.images[0]?.url || null
        if (imageUrls.length === 0 && post.images) {
          imageUrls = post.images.map((img: any) => img.url)
        }
      }
    }

    // collectedProductId 기반 생성 시: rawMetadata에서 데이터 추출
    if (collectedProductId) {
      const collectedProduct = await productRepository.getCollectedProductById(collectedProductId)

      if (collectedProduct) {
        // 이미지 URL 가져오기
        if (imageUrls.length === 0 && collectedProduct.post?.images) {
          imageUrls = collectedProduct.post.images.map((img: any) => img.url)
        }

        // rawMetadata에서 options, variants, shipping, category 추출
        // 요청에 명시적으로 전달되지 않은 경우에만 rawMetadata에서 가져옴
        if (collectedProduct.rawMetadata) {
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

            // categoryId: 요청에 없으면 rawMetadata에서 추출
            if (!categoryId && metadata.category) {
              categoryId = metadata.category
            }
          } catch {
            // rawMetadata 파싱 실패 시 무시 (요청 데이터 그대로 사용)
          }
        }
      }
    }

    if (!collectedProductId) {
      throw new Error('collectedProductId 또는 postId가 필요합니다.')
    }

    return productRepository.create({
      ...data,
      collectedProductId,
      thumbnailUrl,
      imageUrls,
      options,
      variants,
      shippingFee,
      shippingInfo,
      categoryId,
    })
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

    return productRepository.delete(id)
  }
}

export const productService = new ProductService()
