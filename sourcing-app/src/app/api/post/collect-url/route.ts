export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'
import { browserPool, sessionManager } from '@/modules/band-playwright'

/**
 * Playwright로 Band 게시물 페이지를 직접 스크래핑하여 내용 추출
 */
async function findSessionChannelId(userId: number, preferredChannelId: number): Promise<number> {
  // 1) 선택된 채널에 세션이 있으면 사용
  const preferred = await prisma.channel.findFirst({
    where: { id: preferredChannelId, bandSessionCookie: { not: null } },
    select: { id: true },
  })
  if (preferred) return preferred.id

  // 2) 사용자의 아무 채널에서 세션 쿠키가 있는 것 사용
  const anyChannel = await prisma.channel.findFirst({
    where: {
      userId,
      isActive: true,
      platform: 'BAND',
      bandSessionCookie: { not: null },
    },
    select: { id: true },
  })
  if (anyChannel) return anyChannel.id

  throw new Error('밴드 세션이 없습니다. 소매밴드 채널 설정에서 쿠키를 등록해주세요.')
}

async function scrapeBandPost(userId: number, channelId: number, bandUrl: string) {
  const sessionChannelId = await findSessionChannelId(userId, channelId)
  const session = await sessionManager.getValidSession(sessionChannelId)
  if (!session) {
    throw new Error('밴드 세션이 만료되었습니다. 채널 설정에서 쿠키를 다시 등록해주세요.')
  }

  const context = await browserPool.getContext(sessionChannelId, session.cookies)
  const page = await context.newPage()

  try {
    await page.goto(bandUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // 게시물 본문이 로드될 때까지 대기
    await page.waitForSelector('.postBody, .postText, .dPostBody, [class*="postBody"]', { timeout: 15000 }).catch(() => null)

    // 추가 로딩 대기
    await page.waitForTimeout(2000)

    // 게시물 내용 추출
    const postData = await page.evaluate(() => {
      // 본문 텍스트 추출 (여러 셀렉터 시도)
      const contentSelectors = [
        '.postBody .postText',
        '.dPostBody .dPostText',
        '.postText',
        '[class*="postBody"] [class*="postText"]',
        '.postBody',
        '.dPostBody',
      ]
      let content = ''
      for (const sel of contentSelectors) {
        const el = document.querySelector(sel)
        if (el?.textContent?.trim()) {
          content = el.textContent.trim()
          break
        }
      }

      // 작성자 추출
      const authorSelectors = [
        '.postWriter .text',
        '.postAuthor .uName',
        '.dPostWriter .text',
        '[class*="postWriter"] .text',
        '.uName',
      ]
      let author = ''
      for (const sel of authorSelectors) {
        const el = document.querySelector(sel)
        if (el?.textContent?.trim()) {
          author = el.textContent.trim()
          break
        }
      }

      // 이미지 URL 추출
      const imageSelectors = [
        '.postBody img.postPhoto',
        '.dPostBody img',
        '.postPhotoArea img',
        '[class*="postPhoto"] img',
        '.postBody img[src*="band"]',
        '.postBody img[src*="dthumb"]',
      ]
      const images: string[] = []
      const seenUrls = new Set<string>()
      for (const sel of imageSelectors) {
        document.querySelectorAll(sel).forEach((img) => {
          const src = (img as HTMLImageElement).src
          if (src && !seenUrls.has(src) && !src.includes('profile') && !src.includes('emoji')) {
            seenUrls.add(src)
            images.push(src)
          }
        })
        if (images.length > 0) break
      }

      // post_key 추출 (URL 또는 data 속성에서)
      let postKey = ''
      const urlMatch = window.location.href.match(/\/post\/(\w+)/)
      if (urlMatch) postKey = urlMatch[1]

      // data-post-key 속성에서 추출 시도
      if (!postKey) {
        const postEl = document.querySelector('[data-post-key], [data-postkey]')
        if (postEl) {
          postKey = postEl.getAttribute('data-post-key') || postEl.getAttribute('data-postkey') || ''
        }
      }

      return { content, author, images, postKey, url: window.location.href }
    })

    return postData
  } finally {
    await page.close()
    await browserPool.releaseContext(channelId)
  }
}

/**
 * POST: Band URL로 단일 게시물 수집 (Playwright 스크래핑)
 * Body: { url: string, channelId: number }
 *
 * Band API의 post_key 형식(24자 알파벳)과 URL의 숫자 ID가 다르므로
 * Playwright로 직접 페이지를 방문하여 게시물 내용을 추출
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { url, channelId } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '도매밴드를 선택해주세요.' },
        { status: 400 }
      )
    }

    // URL 검증
    const urlMatch = url.match(/band\.us\/band\/(\d+)\/post\/(\w+)/)
    if (!urlMatch) {
      return NextResponse.json(
        { success: false, error: '올바른 밴드 게시물 URL 형식이 아닙니다. (예: https://band.us/band/12345/post/67890)' },
        { status: 400 }
      )
    }

    const postKeyFromUrl = urlMatch[2]

    // 선택된 채널 조회
    const channel = await prisma.channel.findFirst({
      where: {
        id: Number(channelId),
        userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 도매채널입니다.' },
        { status: 400 }
      )
    }

    // Playwright로 게시물 스크래핑
    let postData
    try {
      postData = await scrapeBandPost(userId, channel.id, url)
    } catch (error: any) {
      const msg = error.message || '스크래핑 실패'
      if (msg.includes('세션')) {
        return NextResponse.json(
          { success: false, error: msg },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { success: false, error: `게시물 페이지 접근에 실패했습니다: ${msg}` },
        { status: 500 }
      )
    }

    if (!postData.content) {
      return NextResponse.json(
        { success: false, error: '게시물 내용을 추출할 수 없습니다. 밴드 세션이 만료되었거나 접근 권한이 없을 수 있습니다.' },
        { status: 404 }
      )
    }

    // 게시물 생성
    const title = postData.content.substring(0, 100)
    const externalId = postData.postKey || `url_${postKeyFromUrl}`

    try {
      await postService.create({
        userId,
        channelId: channel.id,
        externalId,
        title,
        content: postData.content,
        author: postData.author || '알 수 없음',
        images: postData.images || [],
      })
    } catch (error: any) {
      if (error.message === '이미 등록된 게시물입니다.') {
        return NextResponse.json(
          { success: false, error: '이미 수집된 게시물입니다.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `게시물이 수집되었습니다. (채널: ${channel.name})`,
    })
  } catch (error: any) {
    console.error('[Post Collect URL] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '게시물 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
