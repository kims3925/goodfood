import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { postKey, bandKey } = await request.json()

    if (!postKey || !bandKey) {
      return NextResponse.json({
        success: false,
        error: 'postKey와 bandKey가 필요합니다.'
      }, { status: 400 })
    }

    const accessToken = process.env.BAND_ACCESS_TOKEN
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Band API 토큰이 설정되지 않았습니다.'
      }, { status: 400 })
    }

    console.log(`🔍 댓글 수집 테스트 시작`)
    console.log(`- Band Key: ${bandKey}`)
    console.log(`- Post Key: ${postKey}`)

    // 댓글 API 호출
    const commentsUrl = new URL('https://openapi.band.us/v2/band/post/comments')
    commentsUrl.searchParams.append('access_token', accessToken)
    commentsUrl.searchParams.append('band_key', bandKey)
    commentsUrl.searchParams.append('post_key', postKey)
    commentsUrl.searchParams.append('locale', 'ko_KR')

    console.log('🌐 댓글 API URL (토큰 숨김):', commentsUrl.toString().replace(accessToken, '[HIDDEN]'))

    const commentsResponse = await fetch(commentsUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'BandAuto/1.0.0'
      }
    })

    console.log('📡 댓글 API 응답 상태:', commentsResponse.status)

    if (!commentsResponse.ok) {
      const errorText = await commentsResponse.text()
      console.error('❌ 댓글 API 오류:', errorText)
      return NextResponse.json({
        success: false,
        error: `댓글 API 오류: ${commentsResponse.status}`,
        details: errorText
      }, { status: 500 })
    }

    const commentsData = await commentsResponse.json()
    console.log('📨 댓글 API 응답 구조:', JSON.stringify(commentsData, null, 2))

    // 댓글 추출
    let comments = []
    if (commentsData.result_data?.items) {
      console.log(`💬 댓글 아이템 개수: ${commentsData.result_data.items.length}`)
      
      comments = commentsData.result_data.items.map((comment: any, index: number) => {
        console.log(`댓글 ${index + 1}:`, {
          body: comment.body,
          content: comment.content, 
          text: comment.text,
          message: comment.message,
          author: comment.author?.name,
          created_at: comment.created_at,
          allKeys: Object.keys(comment)
        })
        
        // 다양한 가능성 체크
        return comment.body || comment.content || comment.text || comment.message || ''
      })
    } else {
      console.log('❌ result_data.items가 없거나 비어있습니다.')
    }

    return NextResponse.json({
      success: true,
      postKey,
      bandKey,
      commentsFound: comments.length,
      comments,
      rawResponse: commentsData
    })

  } catch (error) {
    console.error('❌ 댓글 테스트 오류:', error)
    return NextResponse.json({
      success: false,
      error: '댓글 테스트에 실패했습니다.',
      details: error.message
    }, { status: 500 })
  }
}