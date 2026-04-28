/**
 * 가격정책 content 에서 "배송비:" 항목을 파싱한다.
 *
 * PolicyModal.serializeContent 가 생성하는 content 포맷:
 *   - "...\n배송비: 포함\n..."
 *   - "...\n배송비: 별도\n..."
 *   - ZERO_MARGIN: "판매가 그대로 사용 (마진 없음)\n배송비: 포함"
 *
 * 이 결과를 기준으로 product.repository.create 가 bundleShippingType 을 결정한다.
 * (게시물 본문 키워드 매칭에만 의존하면 본문에 명시 없을 때 NONE 으로 잘못 분류됨)
 *
 * @returns 'separate' | 'included' | null
 *  - 'separate' = 배송비 별도 (= bundleShippingType=SEPARATE)
 *  - 'included' = 배송비 포함 / 무료 (= bundleShippingType=INCLUDED)
 *  - null      = 정책에 배송비 명시 없음 (기존 키워드 추론으로 폴백)
 */
export function parsePolicyShippingType(
  policyContent?: string | null
): 'separate' | 'included' | null {
  if (!policyContent) return null
  // 줄단위로 검사. PolicyModal 은 "배송비: 포함" / "배송비: 별도" 형식으로 출력.
  // 일부 옛 정책은 "배송비: 무료" / "배송비 포함" 등 변종일 수 있어 느슨하게 매칭.
  const lines = policyContent.split(/\r?\n/)
  for (const raw of lines) {
    const m = raw.match(/배송비\s*[:：]?\s*(포함|별도|무료|free|included|separate)/i)
    if (!m) continue
    const tag = m[1].toLowerCase()
    if (tag === '포함' || tag === '무료' || tag === 'free' || tag === 'included') {
      return 'included'
    }
    if (tag === '별도' || tag === 'separate') {
      return 'separate'
    }
  }
  return null
}
