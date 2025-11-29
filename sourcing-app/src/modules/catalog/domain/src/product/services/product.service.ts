import { productRepository } from '../repository/product.repository'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput } from '../types/product.types'

export class ProductService {
  async getList(params: ProductListParams) {
    return productRepository.findMany(params)
  }

  async getById(id: number) {
    return productRepository.findById(id)
  }

  async create(data: ProductCreateInput) {
    // 게시물 존재 확인
    const post = await productRepository.getPostWithImages(data.postId, data.userId)
    if (!post) {
      throw new Error('게시물을 찾을 수 없습니다.')
    }

    // 이미 해당 게시물로 생성된 상품이 있는지 확인
    const existing = await productRepository.findByPostId(data.postId)
    if (existing) {
      throw new Error('이미 이 게시물로 생성된 상품이 있습니다.')
    }

    // 게시물에서 썸네일 가져오기
    const thumbnailUrl = post.images[0]?.imageUrl || null

    return productRepository.create({
      ...data,
      thumbnailUrl,
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
    const existing = await productRepository.findByIdAndUser(id, userId)
    if (!existing) {
      throw new Error('상품을 찾을 수 없습니다.')
    }

    return productRepository.delete(id)
  }
}

export const productService = new ProductService()
