import { postRepository } from '../repository/post.repository'
import { downloadAndSavePostImages, deletePostImageFiles } from '@/modules/utils/imageUtils'
import type { PostListParams, PostCreateInput, PostUpdateInput, SavedPostImage } from '../types/post.types'
import type { BatchResult, ProgressCallback } from '@/types/batch.types'
import { createEmptyBatchResult } from '@/types/batch.types'
import type { CollectedPost } from '@bandauto/db'

export interface PostBatchCreateInput {
  userId: number
  channelId: number
  posts: Array<{
    externalId: string
    title: string
    content: string
    author?: string
    images?: string[] // 외부 이미지 URL 목록
  }>
}

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

  /**
   * 게시물 배치 생성
   * - 중복 체크 (externalId 기준)
   * - 이미지 다운로드 및 로컬 저장
   * - 일괄 생성
   */
  async createBatch(
    data: PostBatchCreateInput,
    onProgress?: ProgressCallback<CollectedPost>
  ): Promise<BatchResult<CollectedPost>> {
    const result = createEmptyBatchResult<CollectedPost>()
    const { userId, channelId, posts } = data

    if (posts.length === 0) {
      return result
    }

    // 1. 배치 중복 체크
    const externalIds = posts.map((p) => p.externalId)
    const existingPosts = await postRepository.findManyByExternalIds(channelId, externalIds)
    const existingSet = new Set(existingPosts.map((p) => p.externalId))

    // 2. 새 게시물만 필터링
    const newPosts = posts.filter((p) => !existingSet.has(p.externalId))
    const skippedCount = posts.length - newPosts.length

    // 중복 항목 결과에 추가
    result.total = posts.length
    result.skippedCount = skippedCount

    if (newPosts.length === 0) {
      console.log(`[PostService.createBatch] All ${posts.length} posts are duplicates`)
      return result
    }

    console.log(`[PostService.createBatch] Processing ${newPosts.length} new posts (${skippedCount} duplicates skipped)`)

    // 3. 각 게시물에 대해 이미지 다운로드 및 생성
    const postsToCreate: Array<{
      userId: number
      channelId: number
      externalId: string
      title: string
      content: string
      author?: string
      savedPostImages?: SavedPostImage[]
    }> = []

    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i]

      try {
        // 이미지 다운로드 (있는 경우)
        let savedPostImages: SavedPostImage[] = []
        if (post.images && post.images.length > 0) {
          try {
            savedPostImages = await downloadAndSavePostImages(post.images)
            console.log(`[PostService.createBatch] Downloaded ${savedPostImages.length} images for post ${post.externalId}`)
          } catch (imageError) {
            console.error(`[PostService.createBatch] Image download failed for ${post.externalId}:`, imageError)
            // 이미지 다운로드 실패해도 게시물은 생성 (이미지 없이)
          }
        }

        postsToCreate.push({
          userId,
          channelId,
          externalId: post.externalId,
          title: post.title,
          content: post.content,
          author: post.author,
          savedPostImages,
        })
      } catch (error: any) {
        console.error(`[PostService.createBatch] Error preparing post ${post.externalId}:`, error)
        result.failedCount++
        result.results.push({
          success: false,
          error: error.message || '게시물 준비 실패',
          errorType: 'PERMANENT',
        })

        // 진행 콜백 호출
        if (onProgress) {
          await onProgress({
            current: i,
            total: newPosts.length,
            result: { success: false, error: error.message },
          })
        }
      }
    }

    // 4. 배치 생성
    if (postsToCreate.length > 0) {
      try {
        const createdPosts = await postRepository.createMany(postsToCreate)

        for (let i = 0; i < createdPosts.length; i++) {
          const created = createdPosts[i]
          result.successCount++
          result.results.push({
            success: true,
            data: created as CollectedPost,
          })

          // 진행 콜백 호출
          if (onProgress) {
            await onProgress({
              current: skippedCount + i,
              total: posts.length,
              result: { success: true, data: created as CollectedPost },
            })
          }
        }
      } catch (batchError: any) {
        console.error(`[PostService.createBatch] Batch creation failed:`, batchError)

        // 배치 실패 시 개별 저장으로 폴백
        console.log(`[PostService.createBatch] Falling back to individual creation`)

        for (let i = 0; i < postsToCreate.length; i++) {
          const post = postsToCreate[i]
          try {
            const created = await postRepository.create({
              ...post,
            })
            result.successCount++
            result.results.push({
              success: true,
              data: created as CollectedPost,
            })

            if (onProgress) {
              await onProgress({
                current: skippedCount + i,
                total: posts.length,
                result: { success: true, data: created as CollectedPost },
              })
            }
          } catch (individualError: any) {
            result.failedCount++
            result.results.push({
              success: false,
              error: individualError.message || '게시물 생성 실패',
              errorType: 'PERMANENT',
            })

            if (onProgress) {
              await onProgress({
                current: skippedCount + i,
                total: posts.length,
                result: { success: false, error: individualError.message },
              })
            }
          }
        }
      }
    }

    console.log(`[PostService.createBatch] Completed: ${result.successCount} success, ${result.failedCount} failed, ${result.skippedCount} skipped`)
    return result
  }
}

export const postService = new PostService()
