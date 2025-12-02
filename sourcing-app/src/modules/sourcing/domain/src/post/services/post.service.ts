import { postRepository } from '../repository/post.repository'
import { downloadAndSavePostImages, deletePostImageFiles } from '@/modules/utils/imageUtils'
import type { PostListParams, PostCreateInput, PostUpdateInput, SavedPostImage } from '../types/post.types'

export class PostService {
  async getList(params: PostListParams) {
    return postRepository.findMany(params)
  }

  async getById(id: number) {
    return postRepository.findById(id)
  }

  async create(data: PostCreateInput) {
    // 중복 체크
    const existing = await postRepository.findByExternalId(data.channelId, data.externalId)
    if (existing) {
      throw new Error('이미 등록된 게시물입니다.')
    }

    // 이미지가 있으면 다운로드 및 저장 (POST_IMAGE_STORAGE_PATH에 저장)
    let savedPostImages: SavedPostImage[] = []
    if (data.images && data.images.length > 0) {
      try {
        savedPostImages = await downloadAndSavePostImages(data.images)
      } catch (error) {
        console.error('이미지 저장 실패:', error)
      }
    }

    return postRepository.create({
      userId: data.userId,
      channelId: data.channelId,
      externalId: data.externalId,
      title: data.title,
      content: data.content,
      author: data.author,
      comments: data.comments,
      savedPostImages,
    })
  }

  async update(id: number, data: PostUpdateInput) {
    const existing = await postRepository.findById(id)
    if (!existing) {
      throw new Error('게시물을 찾을 수 없습니다.')
    }

    return postRepository.update(id, data)
  }

  async delete(id: number) {
    const post = await postRepository.getWithImages(id)
    if (!post) {
      throw new Error('게시물을 찾을 수 없습니다.')
    }

    // 서버에서 실제 이미지 파일 삭제 (POST_IMAGE_STORAGE_PATH에서 삭제)
    // 다른 게시물에서 같은 파일을 참조하지 않는 경우에만 삭제
    if (post.images && post.images.length > 0) {
      // URL에서 파일명 추출: /api/images/post/file/{fileName}
      const fileNames = post.images.map((img) => {
        const url = img.url
        const parts = url.split('/')
        return parts[parts.length - 1]
      })
      await deletePostImageFiles(fileNames, id)
    }

    return postRepository.delete(id)
  }
}

export const postService = new PostService()
