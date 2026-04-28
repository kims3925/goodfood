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
    await page.goto(bandUrl, { waitUntil: 'networkidle', timeout: 30000 })

    // 게시물 본문이 로드될 때까지 대기
    await page.waitForSelector('.postBody, .postText, .dPostBody, [class*="postBody"]', { timeout: 15000 }).catch(() => null)

    // 이미지 lazy-loading 트리거를 위해 스크롤
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // 이미지 완전 로딩 대기
    await page.waitForLoadState('networkidle').catch(() => null)

    // 게시물 내용 추출
    const postData = await page.evaluate(() => {
      // 본문 텍스트 추출
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

      // 이미지 URL 추출 — 게시물 영역 내부에서만
      const images: string[] = []
      const seenUrls = new Set<string>()

      const addImage = (url: string) => {
        if (!url || seenUrls.has(url)) return
        if (url.includes('profile') || url.includes('emoji') || url.includes('icon') || url.includes('sticker')) return
        if (url.includes('spacer') || url.includes('blank') || url.includes('logo') || url.includes('banner')) return
        // 작은 크기 썸네일 제외 (cover, 40x40 등)
        if (/\/[cC]\d+x\d+\//.test(url) || /type=f40_40/.test(url)) return
        seenUrls.add(url)
        const originalUrl = url
          .replace(/\/dthumb-[^/]+\//, '/')
          .replace(/\?type=.*$/, '')
          .replace(/&type=.*$/, '')
        images.push(originalUrl || url)
      }

      // 게시물 본문 영역 찾기
      const postArea = document.querySelector('.postBody, .dPostBody, [class*="postBody"], .postWrap, .postView, #post_detail')

      if (postArea) {
        // 게시물 영역 내 img
        postArea.querySelectorAll('img').forEach((img) => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || ''
          if (src && (src.includes('phinf') || src.includes('dthumb'))) {
            addImage(src)
          }
        })

        // 게시물 영역 내 background-image
        postArea.querySelectorAll('[style*="background-image"]').forEach((el) => {
          const style = (el as HTMLElement).style.backgroundImage
          const match = style.match(/url\(["']?([^"')]+)["']?\)/)
          if (match?.[1] && (match[1].includes('phinf') || match[1].includes('dthumb'))) {
            addImage(match[1])
          }
        })

        // 게시물 영역 내 data 속성
        postArea.querySelectorAll('[data-url], [data-image], [data-photo-url]').forEach((el) => {
          const url = el.getAttribute('data-url') || el.getAttribute('data-image') || el.getAttribute('data-photo-url') || ''
          if (url && (url.includes('phinf') || url.includes('dthumb'))) {
            addImage(url)
          }
        })
      }

      // post_key 추출
      let postKey = ''
      const urlMatch = window.location.href.match(/\/post\/(\w+)/)
      if (urlMatch) postKey = urlMatch[1]
      if (!postKey) {
        const postEl = document.querySelector('[data-post-key], [data-postkey]')
        if (postEl) {
          postKey = postEl.getAttribute('data-post-key') || postEl.getAttribute('data-postkey') || ''
        }
      }

      return { content, author, images, postKey, url: window.location.href, debugImageCount: document.querySelectorAll('img').length }
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
    const { url, channelId, force } = body

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

    // 게시물 생성 (기존에 같은 게시물이 있으면 삭제 후 재생성)
    const title = postData.content.substring(0, 100)
    const externalId = postData.postKey || `url_${postKeyFromUrl}`

    // 기존 게시물이 있는지 확인하고, 가공상품이 없으면 삭제 후 재생성
    const existingPost = await prisma.collectedPost.findFirst({
      where: { channelId: channel.id, externalId },
      include: { collectedProducts: { where: { isConverted: true } } },
    })

    console.log('[Collect URL] force:', force, 'existingPost:', existingPost?.id, 'collectedProducts:', existingPost?.collectedProducts.length)

    if (existingPost) {
      const hasActiveProducts = existingPost.collectedProducts.length > 0
      // force=true 면 가공 이력이 있어도 강제 재수집.
      // 가공이 잘못되어 사용자가 다시 가공해야 하는 케이스 지원.
      // 주의: Product 가 collectedPostId 로 링크되어 있어도 onDelete: SetNull 이라 안전 (Product 자체는 유지).
      if (hasActiveProducts && !force) {
        return NextResponse.json(
          {
            success: false,
            error: '이미 수집되어 가공된 게시물입니다.',
            code: 'ALREADY_PROCESSED', // 클라이언트가 force=true 로 재시도할 수 있도록 신호
          },
          { status: 409 }
        )
      }
      // 기존 게시물 + 부속 데이터(이미지/댓글/CollectedProduct) 정리 후 재생성.
      // 트랜잭션으로 묶어서 부분 실패 방지. CollectedProduct 는 onDelete:Restrict 라 먼저 지워야
      // CollectedPost 삭제 가능. .catch 로 무시하지 않고 명시적 throw 로 사용자에게 원인 노출.
      try {
        await prisma.$transaction([
          prisma.collectedPostImage.deleteMany({ where: { postId: existingPost.id } }),
          prisma.collectedPostComment.deleteMany({ where: { postId: existingPost.id } }),
          prisma.collectedProduct.deleteMany({ where: { postId: existingPost.id } }),
          prisma.collectedPost.delete({ where: { id: existingPost.id } }),
        ])
        console.log('[Collect URL] 기존 게시물 정리 완료 (id=' + existingPost.id + ')')
      } catch (delErr: any) {
        console.error('[Collect URL] 기존 게시물 삭제 실패:', delErr)
        return NextResponse.json(
          {
            success: false,
            error: '기존 게시물 삭제에 실패했습니다: ' + (delErr?.message || '알 수 없음'),
            debug: { existingPostId: existingPost.id, force },
          },
          { status: 500 }
        )
      }
    }

    await postService.create({
      userId,
      channelId: channel.id,
      externalId,
      title,
      content: postData.content,
      author: postData.author || '알 수 없음',
      images: postData.images || [],
    })

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
