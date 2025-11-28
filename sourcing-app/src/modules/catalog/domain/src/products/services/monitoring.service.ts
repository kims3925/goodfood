import prisma from '@bandauto/db'

export interface ProductMonitoringResult {
  id: string
  isAvailable: boolean
  unavailableReason?: string
  hasStockIssue: boolean
  currentContent?: string
}

export class ProductMonitor {
  private static instance: ProductMonitor
  private monitoringQueue: string[] = []
  private isProcessing = false

  static getInstance(): ProductMonitor {
    if (!ProductMonitor.instance) {
      ProductMonitor.instance = new ProductMonitor()
    }
    return ProductMonitor.instance
  }

  // 모니터링 큐에 상품 추가
  async addToMonitoringQueue(postId: string): Promise<void> {
    if (!this.monitoringQueue.includes(postId)) {
      this.monitoringQueue.push(postId)
      console.log(`상품 ${postId}을 모니터링 큐에 추가했습니다.`)
    }
  }

  // 큐 처리 시작
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log('이미 모니터링이 진행 중입니다.')
      return
    }

    this.isProcessing = true
    console.log('상품 모니터링 시작...')

    while (this.monitoringQueue.length > 0) {
      const postId = this.monitoringQueue.shift()
      if (postId) {
        try {
          await this.checkProductAvailability(postId)
          // API 제한을 고려하여 2초 대기
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          console.error(`상품 ${postId} 모니터링 중 오류:`, error)
        }
      }
    }

    this.isProcessing = false
    console.log('상품 모니터링 완료')
  }

  // 개별 상품 상태 확인
  async checkProductAvailability(postId: string): Promise<ProductMonitoringResult> {
    console.log(`상품 ${postId} 상태 확인 중...`)

    // 데이터베이스에서 게시물 정보 조회
    const post = await prisma.collectedPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            bandApiSettings: {
              select: {
                accessToken: true
              }
            }
          }
        },
        wholesaleBand: {
          select: {
            bandKey: true,
            name: true
          }
        }
      }
    })

    if (!post) {
      throw new Error(`게시물 ${postId}를 찾을 수 없습니다.`)
    }

    const result: ProductMonitoringResult = {
      id: postId,
      isAvailable: true,
      hasStockIssue: false
    }

    const accessToken = post.user.bandApiSettings?.accessToken

    if (!accessToken) {
      throw new Error('Band API 설정이 없습니다.')
    }

    try {
      // Band API에서 현재 게시물 상태 확인
      const bandApiUrl = `https://openapi.band.us/v2/band/post?access_token=${accessToken}&band_key=${post.wholesaleBand.bandKey}&post_key=${post.bandPostId}`
      
      const response = await fetch(bandApiUrl)
      const data = await response.json()

      if (!response.ok || !data.result_data) {
        // 게시물이 삭제되었거나 접근 불가
        result.isAvailable = false
        result.unavailableReason = '게시물이 삭제되었거나 접근할 수 없습니다.'
        
        await this.updatePostStatus(postId, {
          isAvailable: false,
          unavailableReason: result.unavailableReason,
          lastCheckedAt: new Date()
        })
        
        console.log(`⚠️ ${post.wholesaleBand.name}의 게시물이 삭제됨: ${post.title}`)
        return result
      }

      const currentPost = data.result_data
      result.currentContent = currentPost.content || ''

      // 품절 관련 키워드 확인
      const stockIssueKeywords = [
        '품절', '재고없음', '재고 없음', '마감', '완료', '종료',
        'soldout', 'sold out', 'out of stock', '매진'
      ]

      const hasStockIssue = stockIssueKeywords.some(keyword => 
        currentPost.content?.toLowerCase().includes(keyword.toLowerCase()) ||
        currentPost.title?.toLowerCase().includes(keyword.toLowerCase())
      )

      if (hasStockIssue) {
        result.hasStockIssue = true
        result.isAvailable = false
        result.unavailableReason = '품절 또는 판매 종료'

        await this.updatePostStatus(postId, {
          isAvailable: false,
          unavailableReason: result.unavailableReason,
          lastCheckedAt: new Date()
        })

        console.log(`⚠️ ${post.wholesaleBand.name}의 상품 품절 감지: ${post.title}`)
      } else {
        // 정상 상태
        await this.updatePostStatus(postId, {
          isAvailable: true,
          unavailableReason: null,
          lastCheckedAt: new Date()
        })

        console.log(`✅ ${post.wholesaleBand.name}의 상품 정상: ${post.title}`)
      }

    } catch (error) {
      console.error(`상품 ${postId} API 호출 오류:`, error)
      // API 오류 시에도 마지막 확인 시간 업데이트
      await this.updatePostStatus(postId, {
        lastCheckedAt: new Date()
      })
    }

    return result
  }

  // 게시물 상태 업데이트
  private async updatePostStatus(postId: string, updates: {
    isAvailable?: boolean
    unavailableReason?: string | null
    lastCheckedAt: Date
  }): Promise<void> {
    await prisma.collectedPost.update({
      where: { id: postId },
      data: updates
    })
  }

  // 모든 처리된 상품들을 모니터링 큐에 추가
  async scheduleAllProcessedProducts(): Promise<void> {
    try {
      const processedPosts = await prisma.collectedPost.findMany({
        where: {
          status: 'PROCESSED',
          isAvailable: true
        },
        select: {
          id: true
        }
      })

      console.log(`${processedPosts.length}개의 처리된 상품을 모니터링 큐에 추가합니다.`)

      for (const post of processedPosts) {
        await this.addToMonitoringQueue(post.id)
      }

      // 큐 처리 시작
      await this.startProcessing()

    } catch (error) {
      console.error('상품 스케줄링 오류:', error)
    }
  }

  // 큐 상태 정보 반환
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.monitoringQueue.length,
      isProcessing: this.isProcessing
    }
  }
}

export const productMonitor = ProductMonitor.getInstance()