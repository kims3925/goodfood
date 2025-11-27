import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: 도매밴드에서 수집 가능한 게시물 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 사용자의 도매밴드 및 API 설정 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      where: {
        userId: parseInt(userId),
        isActive: true,
      },
      include: {
        apiConfig: {
          select: {
            id: true,
            platform: true,
            accessToken: true,
            isActive: true,
          },
        },
      },
    })

    if (wholesaleBands.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '등록된 도매밴드가 없습니다.',
      })
    }

    // 활성화된 API 설정이 있는지 확인
    const activeApiConfig = wholesaleBands.find(
      (band) => band.apiConfig.isActive && band.apiConfig.accessToken
    )

    if (!activeApiConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API 설정을 찾을 수 없습니다. 환경 설정에서 API를 먼저 설정해주세요.',
        },
        { status: 400 }
      )
    }

    const accessToken = activeApiConfig.apiConfig.accessToken

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API Access Token이 설정되지 않았습니다.',
        },
        { status: 400 }
      )
    }

    // 사용자가 이미 등록한 게시물의 externalId 목록 조회
    const existingPosts = await prisma.post.findMany({
      where: {
        userId: parseInt(userId),
      },
      select: {
        externalId: true,
      },
    })
    const existingPostKeys = new Set(existingPosts.map((post) => post.externalId))

    // 모든 도매밴드에서 게시물 조회
    const allPosts: any[] = []

    for (const band of wholesaleBands) {
      try {
        // Band API 호출
        const bandApiUrl = `https://openapi.band.us/v2/band/posts`
        const response = await fetch(
          `${bandApiUrl}?access_token=${accessToken}&band_key=${band.bandKey}&locale=ko_KR`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.error(`Band API 오류 (${band.name}):`, await response.text())
          continue
        }

        const data = await response.json()

        if (data.result_data && data.result_data.items) {
          // 게시물 데이터 변환 (밴드 정보 포함)
          const posts = await Promise.all(
            data.result_data.items.map(async (item: any) => {
              // 각 게시물의 댓글 조회
              let comments: any[] = []
              try {
                const commentsApiUrl = `https://openapi.band.us/v2/band/post/comments`
                const commentsResponse = await fetch(
                  `${commentsApiUrl}?access_token=${accessToken}&band_key=${band.bandKey}&post_key=${item.post_key}`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }
                )

                if (commentsResponse.ok) {
                  const commentsData = await commentsResponse.json()
                  if (commentsData.result_data && commentsData.result_data.items) {
                    comments = commentsData.result_data.items.map((comment: any) => ({
                      comment_key: comment.comment_key,
                      author: comment.author?.name || '알 수 없음',
                      content: comment.content || '',
                    }))
                  }
                }
              } catch (error) {
                console.error(`댓글 조회 실패 (post_key: ${item.post_key}):`, error)
              }

              return {
                post_key: item.post_key,
                title: item.content ? item.content.substring(0, 100) : '(제목 없음)',
                content: item.content || '',
                author: item.author?.name || '알 수 없음',
                images: item.photos ? item.photos.map((photo: any) => photo.url) : [],
                comments,
                band: {
                  id: band.id,
                  name: band.name,
                  bandKey: band.bandKey,
                },
              }
            })
          )

          allPosts.push(...posts)
        }
      } catch (error) {
        console.error(`밴드 ${band.name}의 게시물 조회 실패:`, error)
        continue
      }
    }

    // 이미 등록된 게시물 제외
    const filteredPosts = allPosts.filter(
      (post) => !existingPostKeys.has(post.post_key)
    )

    return NextResponse.json({
      success: true,
      data: filteredPosts,
    })
  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 목록을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
