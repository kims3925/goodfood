/**
 * WholesaleWatchAgent — 도매밴드 5분 변동 감시
 *
 * 지정 도매밴드(예: 경영수산비공개, 외주상품방)를 5분마다 점검하여
 * 원본 게시글의 **품절 / 가격변동 / 삭제**를 감지하고, 연결된
 * 쇼핑몰(ShopProduct)·소매밴드(ChannelProduct) 발행물에 반영한다.
 *
 * ⚠️ 안전 설계 (2026-04-11 / 2026-05-04 대량삭제 사고 재발 방지):
 *  1. 화이트리스트 채널만 (이름에 지정 키워드 포함). 전체 WHOLESALE 스캔 금지.
 *  2. "피드에서 사라짐" 같은 불확실 신호는 사용하지 않는다. 게시글 자체를
 *     Playwright 로 직접 열어 **"삭제된 글입니다"(확실)** 또는 본문의
 *     **명시적 품절 키워드(확실)** 만 신호로 인정한다.
 *  3. per-run 처리 상한(limitPerRun)으로 부하·오작동 폭발 차단. id 커서로 순환.
 *  4. 반영은 가역적(soft delete)만 기본 수행: ShopProduct/ChannelProduct/Product 비활성.
 *     **실제 밴드 글 삭제(Playwright)는 deleteBandPost=false 기본 OFF.**
 *  5. 가격변동은 감지·로그·이벤트만. 자동 가격수정은 하지 않는다(재마진 위험).
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer } from '../types'
import type { AgentEvent, AgentResult } from '../types'
import { browserPool, sessionManager } from '@/modules/band-playwright'
import { extractPriceFromContent } from '@/modules/automation/utils/price-extractor'
// B2B 공급몰 전환 STEP 2-2: 감지 결과 영속화 (SourceSnapshot/sourceStatus/PriceHistory+정책)
import { recordSourceSnapshot, markSourceUnavailable, reportPriceChange } from '@/modules/monitoring/source-monitor.service'

// 감시 대상 도매밴드 이름 키워드 (부분일치, 대소문자 무시)
const DEFAULT_WHITELIST = ['경영수산', '외주상품']

// 본문에서 품절/마감을 확정짓는 키워드 (확실 신호만)
const SOLD_OUT_PATTERN = /(품\s*절|매\s*진|완\s*판|마\s*감되었|판매\s*종료|판매\s*마감|솔드아웃|sold\s*out)/i

// 가격변동 임계치: 절대 500원 이상 AND 3% 이상 차이일 때만 변동으로 본다.
const PRICE_DELTA_ABS = 500
const PRICE_DELTA_RATIO = 0.03

const PER_RUN_DEFAULT = 25

// 프로세스 수명 동안의 id 커서 (DB 컬럼 없이 순환 스캔) — 재시작 시 0부터 재개.
let idCursor = 0
// 5분 주기가 이전 실행을 추월하지 않도록 in-flight 락 (Playwright 동시 폭주 방지)
let isRunning = false

interface WholesaleWatchOptions {
  /** 가역적 soft-delete 반영 수행 (기본 true) */
  autoFix?: boolean
  /** 실제 밴드 글 Playwright 삭제까지 수행 (기본 false — 위험) */
  deleteBandPost?: boolean
  /** 1회 실행당 Playwright 조회 상한 (기본 25) */
  limitPerRun?: number
  /** 감시 대상 도매밴드 이름 키워드 */
  whitelist?: string[]
}

type PostState =
  | { kind: 'DELETED' }
  | { kind: 'SOLD_OUT'; price: number | null; excerpt?: string }
  | { kind: 'OK'; price: number | null; excerpt?: string }
  | { kind: 'UNKNOWN' } // 조회 실패 — 절대 반영하지 않음

export class WholesaleWatchAgent extends AgentBase {
  readonly name = 'wholesale-watch'
  readonly layer = AgentLayer.SOURCING

  getSubscribedEvents(): string[] {
    return ['schedule.wholesale.watch', 'wholesale.watch.requested']
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      const summary = await this.runWholesaleWatch(event?.data || {})
      return { success: true, data: summary, duration: Date.now() - start }
    } catch (error: any) {
      await this.log('ERROR', `wholesale-watch 실패: ${error?.message}`)
      return { success: false, error: error?.message, duration: Date.now() - start }
    }
  }

  async onSchedule(): Promise<void> {
    await this.runWholesaleWatch({})
  }

  /**
   * 메인 루프 — 화이트리스트 도매밴드의 발행 상품들을 순환 점검.
   */
  async runWholesaleWatch(options: WholesaleWatchOptions = {}): Promise<{
    checked: number
    soldOut: number
    deleted: number
    priceChanged: number
    shopDeactivated: number
    channelDeactivated: number
    bandPostDeleted: number
    skippedNoSession: number
    errors: number
  }> {
    const autoFix = options.autoFix !== false // 기본 true (가역적 반영)
    const deleteBandPost = options.deleteBandPost === true // 기본 false (위험)
    const limit = Math.max(1, Math.min(100, options.limitPerRun ?? PER_RUN_DEFAULT))
    const whitelist = (options.whitelist && options.whitelist.length > 0) ? options.whitelist : DEFAULT_WHITELIST

    const result = {
      checked: 0, soldOut: 0, deleted: 0, priceChanged: 0,
      shopDeactivated: 0, channelDeactivated: 0, bandPostDeleted: 0,
      skippedNoSession: 0, errors: 0,
    }

    // 이전 실행이 아직 진행 중이면 이번 주기는 건너뛴다 (Playwright 동시 폭주 방지)
    if (isRunning) {
      console.log('[wholesale-watch] 이전 실행 진행 중 — 이번 주기 건너뜀')
      return result
    }
    isRunning = true
    try {

    // 1) 화이트리스트 도매밴드 채널 (bandNo 필수 — 직접 진입용)
    const channels = await prisma.channel.findMany({
      where: {
        kind: 'WHOLESALE',
        isActive: true,
        deletedAt: null,
        bandNo: { not: null },
        OR: whitelist.map((kw) => ({ name: { contains: kw } })),
      },
      select: { id: true, name: true, bandNo: true, userId: true },
    })
    if (channels.length === 0) {
      console.log('[wholesale-watch] 화이트리스트 도매밴드 없음 — 종료')
      return result
    }
    const channelIds = channels.map((c) => c.id)
    const channelById = new Map(channels.map((c) => [c.id, c]))

    // 2) 후보 상품: 위 채널에서 소싱 + 활성 발행물(쇼핑몰 또는 소매밴드) 보유 + 원본글 존재
    //    id 커서로 순환 (idCursor 초과분부터 limit 개). 끝까지 돌면 0으로 리셋.
    const candidates = await prisma.product.findMany({
      where: {
        channelId: { in: channelIds },
        deletedAt: null,
        isActive: true,
        collectedPostId: { not: null },
        id: { gt: idCursor },
        OR: [
          { channelProducts: { some: { deletedAt: null } } },
          { shopProducts: { some: { deletedAt: null } } },
        ],
      },
      select: {
        id: true,
        name: true,
        channelId: true,
        collectedPostId: true,
        wholesalePrice: true,
        collectedPost: { select: { externalId: true } },
      },
      orderBy: { id: 'asc' },
      take: limit,
    })

    if (candidates.length === 0) {
      // 끝까지 돌았음 → 다음 실행은 처음부터
      idCursor = 0
      console.log('[wholesale-watch] 순환 완료 — 커서 리셋')
      return result
    }
    idCursor = candidates[candidates.length - 1].id

    // 3) userId 별 세션 채널 1개씩 확보 (도매밴드 자체엔 세션이 없을 수 있어 사용자 임의 채널 세션 사용)
    const sessionChannelCache = new Map<number, number | null>()
    const resolveSessionChannel = async (userId: number): Promise<number | null> => {
      if (sessionChannelCache.has(userId)) return sessionChannelCache.get(userId)!
      const ch = await prisma.channel.findFirst({
        where: { userId, isActive: true, platform: 'BAND', bandSessionCookie: { not: null } },
        select: { id: true },
      })
      const id = ch?.id ?? null
      sessionChannelCache.set(userId, id)
      return id
    }

    for (const product of candidates) {
      const channel = channelById.get(product.channelId!)
      const postKey = product.collectedPost?.externalId
      if (!channel || !channel.bandNo || !postKey) continue

      try {
        const sessionChannelId = await resolveSessionChannel(channel.userId)
        if (!sessionChannelId) {
          result.skippedNoSession++
          continue
        }
        const session = await sessionManager.getValidSession(sessionChannelId)
        if (!session) {
          result.skippedNoSession++
          continue
        }

        const url = `https://band.us/band/${channel.bandNo}/post/${postKey}`
        const state = await this.fetchPostState(sessionChannelId, session.cookies, url)
        result.checked++

        if (state.kind === 'UNKNOWN') continue // 조회 실패 → 절대 반영하지 않음

        // 점검 스냅샷 기록 (STEP 2-2 — 매 점검마다 근거 보존)
        if (product.collectedPostId) {
          await recordSourceSnapshot({
            productId: product.id,
            collectedPostId: product.collectedPostId,
            status: state.kind === 'DELETED' ? 'POST_DELETED' : state.kind === 'SOLD_OUT' ? 'SOLDOUT' : 'ACTIVE',
            wholesalePrice: state.kind === 'DELETED' ? null : state.price,
            rawText: state.kind === 'DELETED' ? '삭제된 글입니다' : state.excerpt ?? null,
          })
        }

        // 가격변동 감지 — PriceHistory 기록 + 테넌트 정책(NOTIFY_ONLY/AUTO_MARGIN) 적용
        if ((state.kind === 'OK' || state.kind === 'SOLD_OUT') && state.price != null) {
          const stored = product.wholesalePrice != null ? Number(product.wholesalePrice) : null
          if (stored && stored > 0) {
            const diff = Math.abs(state.price - stored)
            if (diff >= PRICE_DELTA_ABS && diff / stored >= PRICE_DELTA_RATIO) {
              result.priceChanged++
              await this.log('WARN', `가격변동 감지: product#${product.id} "${product.name}" 저장 ${stored} → 현재 ${state.price}`, {
                productId: product.id, storedPrice: stored, currentPrice: state.price, url,
              })
              await this.emitEvent('wholesale.watch.price_changed', {
                productId: product.id, storedPrice: stored, currentPrice: state.price,
              })
              const applied = await reportPriceChange({
                userId: channel.userId,
                productId: product.id,
                productName: product.name,
                newWholesalePrice: state.price,
              })
              if (applied?.applied) {
                await this.log('INFO', `판매가 자동 갱신 (AUTO_MARGIN): product#${product.id} ${applied.oldPrice} → ${applied.newPrice}`)
              }
            }
          }
        }

        if (state.kind === 'DELETED' || state.kind === 'SOLD_OUT') {
          if (state.kind === 'DELETED') result.deleted++
          else result.soldOut++

          await this.log('INFO', `${state.kind} 감지: product#${product.id} "${product.name}" (도매밴드: ${channel.name})`, {
            productId: product.id, state: state.kind, url,
          })
          await this.emitEvent(state.kind === 'DELETED' ? 'wholesale.watch.deleted' : 'wholesale.watch.sold_out', {
            productId: product.id, channelName: channel.name,
          })

          // 사유 보존 + 관리자 알림 (STEP 2-2 — autoFix 여부와 무관하게 상태는 기록)
          await markSourceUnavailable({
            userId: channel.userId,
            productId: product.id,
            productName: product.name,
            status: state.kind === 'DELETED' ? 'POST_DELETED' : 'SOLDOUT',
            channelName: channel.name,
          })

          if (autoFix) {
            const now = new Date()
            // 쇼핑몰 발행물 비활성 (가역) — 고객 주문 차단
            const shopRes = await prisma.shopProduct.updateMany({
              where: { productId: product.id, deletedAt: null },
              data: { deletedAt: now },
            })
            result.shopDeactivated += shopRes.count
            // 소매밴드 발행물 비활성 (가역)
            const chRes = await prisma.channelProduct.updateMany({
              where: { productId: product.id, deletedAt: null },
              data: { deletedAt: now, isActive: false },
            })
            result.channelDeactivated += chRes.count
            // 상품 자체 비노출 (가역 — deletedAt 은 보존, 복원 가능)
            await prisma.product.update({
              where: { id: product.id },
              data: { isActive: false },
            }).catch(() => {})

            // 실제 밴드 글 삭제는 명시적 opt-in 시에만 (기본 OFF)
            if (deleteBandPost) {
              const activePosts = await prisma.channelProduct.findMany({
                where: { productId: product.id, postKey: { not: null } },
                select: { channelId: true, postKey: true, channel: { select: { channelKey: true, name: true } } },
                take: 10,
              })
              for (const cp of activePosts) {
                if (!cp.postKey || !cp.channel) continue
                try {
                  const { bandPlaywrightService } = await import('@/modules/band-playwright')
                  const del = await bandPlaywrightService.deletePost({
                    channelId: cp.channelId,
                    bandKey: cp.channel.channelKey,
                    bandName: cp.channel.name,
                    postKey: cp.postKey,
                  })
                  if (del.success) result.bandPostDeleted++
                } catch (e: any) {
                  await this.log('WARN', `밴드 글 삭제 실패 product#${product.id}: ${e?.message}`)
                }
              }
            }
          }
        }
      } catch (e: any) {
        result.errors++
        console.error(`[wholesale-watch] product#${product.id} 처리 오류:`, e?.message)
      }
    }

    // KPI 기록 (AgentDefinition seed 시 대시보드 반영)
    await this.recordKpi('wholesale_checked', result.checked)
    await this.recordKpi('wholesale_sold_out', result.soldOut)
    await this.recordKpi('wholesale_deleted', result.deleted)
    await this.recordKpi('wholesale_price_changed', result.priceChanged)

    console.log(`[wholesale-watch] 완료 — ${JSON.stringify(result)} (autoFix=${autoFix}, deleteBandPost=${deleteBandPost}, cursor=${idCursor})`)
    return result
    } finally {
      isRunning = false
    }
  }

  /**
   * 단일 게시글 상태를 Playwright 로 직접 확인.
   * - "삭제된 글입니다" 또는 진입 실패(본문 없음) → DELETED
   * - 본문에 명시적 품절 키워드 → SOLD_OUT
   * - 그 외 → OK (+ 추출 가격)
   * - 네트워크/세션 오류 → UNKNOWN (절대 반영 금지)
   */
  private async fetchPostState(
    sessionChannelId: number,
    cookies: string,
    url: string
  ): Promise<PostState> {
    let page: any = null
    try {
      const context = await browserPool.getContext(sessionChannelId, cookies)
      page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // 삭제글 탐지 (확실 신호)
      const deleted = await page.$('text=삭제된 글입니다').catch(() => null)
      if (deleted) return { kind: 'DELETED' }

      // 본문 로드 대기 (실패해도 계속)
      await page.waitForSelector('.dPostBody, .postBody, .postText, [class*="postBody"]', { timeout: 12000 }).catch(() => null)

      const bodyText: string = await page.evaluate(() => {
        const sels = ['.dPostBody .dPostText', '.postBody .postText', '.postText', '.dPostBody', '.postBody']
        for (const s of sels) {
          const el = document.querySelector(s)
          if (el && (el as HTMLElement).textContent && (el as HTMLElement).textContent!.trim()) {
            return (el as HTMLElement).textContent!.trim()
          }
        }
        return ''
      }).catch(() => '')

      // 본문을 전혀 못 읽었으면 삭제/접근불가 가능성 — 단, 확신 못하므로 UNKNOWN (반영 금지)
      if (!bodyText) {
        const stillDeleted = await page.$('text=삭제된').catch(() => null)
        if (stillDeleted) return { kind: 'DELETED' }
        return { kind: 'UNKNOWN' }
      }

      const price = extractPriceFromContent(bodyText)
      if (SOLD_OUT_PATTERN.test(bodyText)) {
        // 감지 근거: 품절 키워드 주변 발췌 (SourceSnapshot.rawText 보존용)
        const m = bodyText.match(SOLD_OUT_PATTERN)
        const idx = m?.index ?? 0
        const excerpt = bodyText.slice(Math.max(0, idx - 80), idx + 120)
        return { kind: 'SOLD_OUT', price, excerpt }
      }
      return { kind: 'OK', price, excerpt: bodyText.slice(0, 200) }
    } catch {
      return { kind: 'UNKNOWN' }
    } finally {
      if (page) { try { await page.close() } catch { /* noop */ } }
    }
  }
}

export const wholesaleWatchAgent = new WholesaleWatchAgent()
