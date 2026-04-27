export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/policies/seed-from-checklist
 *
 * 6개 도매방(킹/가족/초록이네/나은/VIP/SD푸드)의 표준 가격정책을
 * BandAuto_체크리스트_v4.xlsx 값으로 일괄 등록/갱신.
 *
 * 동작:
 *  - 사용자의 WHOLESALE 채널만 대상으로 함
 *  - 채널명에 keyword가 포함된 채널을 매칭 (case-insensitive contains)
 *  - "BandAuto 표준 (v4 체크리스트)" 라는 고정 이름의 정책을 찾아 upsert
 *    (기존에 같은 이름이 있으면 content 갱신, 없으면 신규 생성)
 *  - 기존 다른 정책은 건드리지 않음 (사용자가 수동 비활성화 가능)
 *
 * Body 옵션 (모두 선택):
 *  - { dryRun?: boolean } — 실제 저장 없이 매칭/생성 예정 결과만 반환
 *
 * 반환:
 *  - 매칭/생성/갱신/건너뜀 채널 목록
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma, { ChannelKind } from '@bandauto/db'

// ── 정책 유형 ─────────────────────────────────────────
type PolicyType = 'ZERO_MARGIN' | 'BRACKET_MARGIN' | 'BRACKET_MARGIN_EXTENDED' | 'SD_FOOD_SPECIAL'

interface BracketRow {
  from: string
  to: string
  margin: string
  isDynamic?: boolean
  dynBracketSize?: string
  dynPerBracket?: string
}

// ── v4 표 데이터 ──────────────────────────────────────
// 가족도매방 / 초록이네 (3행)
const FAMILY_BRACKETS: BracketRow[] = [
  { from: '1', to: '19900', margin: '0' },
  { from: '19901', to: '29900', margin: '1000' },
  { from: '29901', to: '40000', margin: '2000' },
]

// 나은도매 / VIP도매 / SD푸드 (10행 + 1 동적행)
const NAUN_BRACKETS: BracketRow[] = [
  { from: '1', to: '9900', margin: '4000' },
  { from: '9901', to: '19900', margin: '5000' },
  { from: '19901', to: '29900', margin: '6000' },
  { from: '29901', to: '39900', margin: '7000' },
  { from: '39901', to: '49900', margin: '8000' },
  { from: '49901', to: '59900', margin: '9000' },
  { from: '59901', to: '69900', margin: '10000' },
  { from: '69901', to: '79900', margin: '11000' },
  { from: '79901', to: '89900', margin: '12000' },
  { from: '89901', to: '99900', margin: '13000' },
  { from: '99901', to: '', margin: '13000', isDynamic: true, dynBracketSize: '1', dynPerBracket: '1000' },
]

interface ChannelSpec {
  /** 채널명 매칭에 쓸 키워드 (소문자 contains 매칭) */
  keywords: string[]
  /** 정책에 들어갈 표시용 라벨 (로그/응답용) */
  label: string
  policyType: PolicyType
  brackets: BracketRow[]
  /** "N원 이상 제외" 값 — undefined면 미설정 */
  excludeAbove?: string
  shippingType: 'free' | 'included' | 'separate'
}

const CHANNEL_SPECS: ChannelSpec[] = [
  {
    keywords: ['킹도매', '킹 도매'],
    label: '킹도매방',
    policyType: 'ZERO_MARGIN',
    brackets: [],
    excludeAbove: '100001',
    shippingType: 'separate',
  },
  {
    keywords: ['가족도매', '가족 도매'],
    label: '가족도매방',
    policyType: 'BRACKET_MARGIN',
    brackets: FAMILY_BRACKETS,
    excludeAbove: '40001',
    shippingType: 'separate',
  },
  {
    keywords: ['초록이네', '초록'],
    label: '초록이네',
    policyType: 'BRACKET_MARGIN',
    brackets: FAMILY_BRACKETS,
    excludeAbove: '40001',
    shippingType: 'separate',
  },
  {
    keywords: ['나은도매', '나은 도매'],
    label: '나은도매',
    policyType: 'BRACKET_MARGIN_EXTENDED',
    brackets: NAUN_BRACKETS,
    excludeAbove: '100001',
    shippingType: 'separate',
  },
  {
    keywords: ['vip도매', 'vip 도매'],
    label: 'VIP도매',
    policyType: 'BRACKET_MARGIN_EXTENDED',
    brackets: NAUN_BRACKETS,
    excludeAbove: '100001',
    shippingType: 'separate',
  },
  {
    keywords: ['sd푸드', 'sd 푸드', 'sd-푸드', 'sdfood'],
    label: 'SD푸드',
    policyType: 'SD_FOOD_SPECIAL',
    brackets: NAUN_BRACKETS,
    excludeAbove: '100001',
    shippingType: 'separate',
  },
]

const SEED_POLICY_NAME = 'BandAuto 표준 (v4 체크리스트)'
const SEED_POLICY_DESCRIPTION = 'BandAuto_체크리스트_v4.xlsx 의 가격정책 표를 그대로 옮긴 표준 정책. seed-from-checklist 엔드포인트로 자동 생성/갱신됨.'

/**
 * PolicyModal serializeContent 와 동일 포맷으로 마크다운 테이블 생성.
 * 한 곳에 두 번 정의되는 게 부담이지만, modal 의 default-export 컴포넌트에서
 * 함수만 추출해 재수출하는 비용보다 작다고 판단해 의도적 중복.
 */
function serializeContent(spec: ChannelSpec): string {
  const { policyType, brackets, excludeAbove, shippingType } = spec

  if (policyType === 'ZERO_MARGIN') {
    return '판매가 그대로 사용 (마진 없음)\n배송비: ' + (shippingType === 'included' ? '포함' : '별도')
  }

  const prefix =
    policyType === 'SD_FOOD_SPECIAL'
      ? '## SD푸드 특수 규칙\n공급가_출처: 댓글에서 추출\n본문판매가_표시시: 판매가 그대로 사용\n\n'
      : ''

  const lines: string[] = ['## 마진 구간표', '| 구간 | +마진 |', '|------|-------|']
  for (const row of brackets) {
    const from = row.from
    const margin = row.margin
    if (row.isDynamic) {
      const bs = row.dynBracketSize || '1'
      const pb = row.dynPerBracket || '1000'
      lines.push(`| ${from}원 이상 | +${margin}원~ (${bs}만원 구간마다 +${pb}원 추가) |`)
    } else if (row.to) {
      lines.push(`| ${from}원 ~ ${row.to}원 | +${margin}원 |`)
    }
  }
  if (excludeAbove) {
    lines.push('', `${excludeAbove}원 이상 제외`)
  }
  const shipLabel = shippingType === 'included' ? '포함' : '별도'
  lines.push('배송비: ' + shipLabel)
  if (shippingType === 'separate' && policyType === 'SD_FOOD_SPECIAL') {
    lines.push('기준가: 공급가 + 배송비 합산')
  }
  return prefix + lines.join('\n')
}

interface SeedPerChannelResult {
  channelId: number
  channelName: string
  spec: string
  action: 'created' | 'updated' | 'unchanged' | 'dryRun'
  policyId?: number
}

interface SeedSkippedSpec {
  spec: string
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = !!body?.dryRun

    const channels = await prisma.channel.findMany({
      where: {
        userId: currentUser.userId,
        kind: ChannelKind.WHOLESALE,
        deletedAt: null,
      },
      select: { id: true, name: true },
    })

    const results: SeedPerChannelResult[] = []
    const skipped: SeedSkippedSpec[] = []

    for (const spec of CHANNEL_SPECS) {
      const matchedChannels = channels.filter((c) => {
        const lower = (c.name || '').toLowerCase()
        return spec.keywords.some((k) => lower.includes(k.toLowerCase()))
      })

      if (matchedChannels.length === 0) {
        skipped.push({ spec: spec.label, reason: '매칭되는 채널 없음 (채널명 확인 필요)' })
        continue
      }

      const content = serializeContent(spec)

      for (const ch of matchedChannels) {
        const existing = await prisma.pricingPolicy.findFirst({
          where: {
            userId: currentUser.userId,
            channelId: ch.id,
            name: SEED_POLICY_NAME,
          },
          select: { id: true, content: true },
        })

        if (dryRun) {
          results.push({
            channelId: ch.id,
            channelName: ch.name,
            spec: spec.label,
            action: 'dryRun',
            policyId: existing?.id,
          })
          continue
        }

        if (existing) {
          if (existing.content === content) {
            results.push({
              channelId: ch.id,
              channelName: ch.name,
              spec: spec.label,
              action: 'unchanged',
              policyId: existing.id,
            })
          } else {
            const updated = await prisma.pricingPolicy.update({
              where: { id: existing.id },
              data: {
                content,
                description: SEED_POLICY_DESCRIPTION,
                isActive: true,
              },
              select: { id: true },
            })
            results.push({
              channelId: ch.id,
              channelName: ch.name,
              spec: spec.label,
              action: 'updated',
              policyId: updated.id,
            })
          }
        } else {
          const created = await prisma.pricingPolicy.create({
            data: {
              userId: currentUser.userId,
              channelId: ch.id,
              name: SEED_POLICY_NAME,
              description: SEED_POLICY_DESCRIPTION,
              content,
              isActive: true,
            },
            select: { id: true },
          })
          results.push({
            channelId: ch.id,
            channelName: ch.name,
            spec: spec.label,
            action: 'created',
            policyId: created.id,
          })
        }
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      unchanged: results.filter((r) => r.action === 'unchanged').length,
      dryRun: results.filter((r) => r.action === 'dryRun').length,
      skippedSpecs: skipped.length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      results,
      skipped,
      policyName: SEED_POLICY_NAME,
    })
  } catch (error: any) {
    console.error('[seed-from-checklist] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '정책 시드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
